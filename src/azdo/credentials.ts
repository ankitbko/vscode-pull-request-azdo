import * as azdev from 'azure-devops-node-api';
import { IRequestHandler } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';
import { Identity } from 'azure-devops-node-api/interfaces/IdentitiesInterfaces';
import * as jwt from 'jsonwebtoken';
import * as vscode from 'vscode';
import { IGit } from '../api/api';
import Logger from '../common/logger';
import { parseRepositoryRemotes, Remote } from '../common/remote';
import { ITelemetry } from '../common/telemetry';
import { SETTINGS_NAMESPACE } from '../constants';


const PROJECT_SETTINGS = 'projectName';
const ORGURL_SETTINGS = 'orgUrl';
const PATTOKEN_SETTINGS = 'patToken';
const TRY_AGAIN = vscode.l10n.t('Try again?');
const CANCEL = vscode.l10n.t('Cancel');
const ERROR = vscode.l10n.t('Error signing in to Azure DevOps');

class AzdoOrgConfig {
	constructor(public orgUrl: string, public projectName: string) {}
}

export class Azdo {
	private _authHandler: IRequestHandler;
	public connection: azdev.WebApi;
	public authenticatedUser: Identity | undefined;

	constructor(public orgUrl: string, public projectName: string, private token: string, private isPatTokenAuth: boolean = false) {
		if (isPatTokenAuth) {
			this._authHandler = azdev.getPersonalAccessTokenHandler(token, true);
		} else {
			this._authHandler = azdev.getBearerHandler(token, true);
		}
		this.connection = this.getNewWebApiClient(this.orgUrl);
	}

	public getNewWebApiClient(orgUrl: string): azdev.WebApi {
		return new azdev.WebApi(orgUrl, this._authHandler);
	}

	public isTokenExpired(): boolean {
		try {
			if (this.isPatTokenAuth) {
				return false;
			}

			const decodedToken = jwt.decode(this.token) as { exp: number };
			if (!decodedToken || !decodedToken.exp) {
				return true;
			}
			const expirationTime = decodedToken.exp * 1000; // Convert to milliseconds
			const currentTime = Date.now();
			const bufferTime = 60 * 1000; // 1 minute in milliseconds

			return currentTime >= (expirationTime - bufferTime);
		} catch (error) {
			// If there's an error decoding the token, consider it expired
			return true;
		}
	}
}

export class CredentialStore implements vscode.Disposable {
	static ID = 'AzdoRepository';
	private _azdoAPI: Azdo | undefined;
	private orgConfig: AzdoOrgConfig | undefined;
	private _disposables: vscode.Disposable[];
	private _onDidInitialize: vscode.EventEmitter<void> = new vscode.EventEmitter();
	public readonly onDidInitialize: vscode.Event<void> = this._onDidInitialize.event;
	private _sessionId: string | undefined;
	private _sessionOptions: vscode.AuthenticationGetSessionOptions = { createIfNone: true };

	constructor(private readonly _telemetry: ITelemetry, private readonly _secretStore: vscode.SecretStorage, private readonly _gitAPI: IGit) {
		this._disposables = [];
		this._disposables.push(
			vscode.authentication.onDidChangeSessions(async () => {
				if (!this.isAuthenticated()) {
					return await this.initialize();
				}
			}),
		);
	}

	public async initialize(): Promise<void> {
		this._azdoAPI = await this.login();
	}

	public async reset() {
		this._sessionOptions.forceNewSession = false;
		this._sessionOptions.createIfNone = false;
		this._sessionOptions.clearSessionPreference = false;
		await this.initialize();
	}

	public async forceAuthentication() {
		this._sessionOptions.forceNewSession = true;
		this._sessionOptions.createIfNone = false;
		this._sessionOptions.clearSessionPreference = true;
		await this.initialize();
	}

	public isAuthenticated(): boolean {
		return !!this._azdoAPI && !this._azdoAPI.isTokenExpired();
	}

	public getHub(): Azdo | undefined {
		return this._azdoAPI;
	}

	public async logout(): Promise<void> {
		this._azdoAPI = undefined;
	}

	public inferOrgConfigFromGitRemote(remotes: Remote[]): AzdoOrgConfig | undefined {
		if (remotes.length !== 1) {
			Logger.appendLine(`Unable to infer org config from git. Remote Length: ${remotes.length}. Remotes: ${remotes.map(r => r.remoteName).join(',')}`, CredentialStore.ID);
			return undefined;
		}

		const url = remotes[0].url;
		// Assumption for url: https://<org>@dev.azure.com/<org>/<project>/_git/<repo>

		Logger.appendLine('Inferring org config from url: ' + url, CredentialStore.ID);
		const orgUrlMatch = url.match(/https:\/\/(.+?)@dev\.azure\.com\/(.+?)\//);
		Logger.debug(`orgUrlMatch: ${orgUrlMatch}`, CredentialStore.ID);

		const orgUrl = orgUrlMatch && orgUrlMatch.length > 2 ? `https://dev.azure.com/${orgUrlMatch[2]}` : undefined; // should be parsed to https://dev.azure.com/<org>
		const projectNameMatch = url.match(/\/([^\/]+)\/_git\//);
		Logger.debug(`projectNameMatch: ${projectNameMatch}`, CredentialStore.ID);

		const projectName = projectNameMatch && projectNameMatch.length > 1 ? projectNameMatch[1] : undefined; // should be parsed to <project>
		Logger.appendLine(`Inferred orgUrl: ${orgUrl}, projectName: ${projectName}`, CredentialStore.ID);

		return new AzdoOrgConfig(orgUrl, projectName);
	}

	public getOrgConfig(): AzdoOrgConfig | undefined {
		let projectName = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE).get<string | undefined>(PROJECT_SETTINGS);
		let orgUrl = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE).get<string | undefined>(ORGURL_SETTINGS);

		if (!projectName || !orgUrl) {
			const remotes = this._gitAPI.repositories.map(r => parseRepositoryRemotes(r));
			const inferredConfigs = remotes.map(r => this.inferOrgConfigFromGitRemote(r)).filter(c => !!c && c.orgUrl && c.projectName);

			// TODO: Need better way of handling multiple repositories. CredentialStore should be initialized within each FolderRepositoryManager and scoped to particular AzDORepository.
			if ([...new Set(inferredConfigs.map(a => a.orgUrl))].length !== 1 || [...new Set(inferredConfigs.map(a => a.projectName))].length !== 1) {
				Logger.appendLine(`Unable to infer org config from git. Repository Length: ${this._gitAPI.repositories.length}. Inferred Configs: ${inferredConfigs}`, CredentialStore.ID);
				return undefined;
			}

			Logger.appendLine(`Selected orgUrl: ${inferredConfigs[0]?.orgUrl}, projectName: ${inferredConfigs[0]?.projectName}`, CredentialStore.ID);
			return inferredConfigs[0];
		}

		if (!projectName) {
			Logger.appendLine('Project name is not provided', CredentialStore.ID);
			this._telemetry.sendTelemetryEvent('auth.failed');
			return undefined;
		}

		if (!orgUrl) {
			Logger.appendLine('orgUrl is not provided', CredentialStore.ID);
			this._telemetry.sendTelemetryEvent('auth.failed');
			return undefined;
		}

		Logger.appendLine(`orgUrl is ${orgUrl}. Project name is ${projectName}`, CredentialStore.ID);
		return new AzdoOrgConfig(orgUrl, projectName);
	}

	public async login(): Promise<Azdo | undefined> {
		/* __GDPR__
			"auth.start" : {}
		*/
		this._telemetry.sendTelemetryEvent('auth.start');

		const orgConfig = this.getOrgConfig();
		if (!orgConfig) {
			Logger.appendLine('Unable to get org config', CredentialStore.ID);
			this._telemetry.sendTelemetryEvent('auth.failed');
			return undefined;
		}

		let retry: boolean = true;

		while (retry) {
			try
			{
				let isPatTokenAuth = true;
				let token = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE).get<string | undefined>(PATTOKEN_SETTINGS);

				if(token === undefined || token === null || token === '') {
					const session = await this.getSession(this._sessionOptions);
					if (!session) {
						Logger.appendLine('Auth> Unable to get session', CredentialStore.ID);
						this._telemetry.sendTelemetryEvent('auth.failed');
						return undefined;
					}

					this._sessionId = session.id;
					token = await this.getToken(session);

					if (!token) {
						Logger.appendLine('Auth> Unable to get token', CredentialStore.ID);
						this._telemetry.sendTelemetryEvent('auth.failed');
						return undefined;
					}

					isPatTokenAuth = false;
				}

				const azdo = new Azdo(orgConfig.orgUrl, orgConfig.projectName, token, isPatTokenAuth);
				azdo.authenticatedUser = (await azdo.connection.connect()).authenticatedUser;

				Logger.debug(`Auth> Successful: Logged userid: ${azdo?.authenticatedUser?.id}`, CredentialStore.ID);
				this._telemetry.sendTelemetryEvent('auth.success');
				this._sessionOptions.forceNewSession = false;
				this._sessionOptions.createIfNone = true;
				this._sessionOptions.clearSessionPreference = false;

				return azdo;
			} catch (e) {
				Logger.appendLine(`Auth> Failed: ${e.message}`, CredentialStore.ID);
				this._telemetry.sendTelemetryEvent('auth.failed');
				if (e instanceof Error && e.stack) {
					Logger.appendLine(e.stack);
				}
				if (e.message === 'User canceled authentication') {
					return undefined;
				}
			}

			retry = (await vscode.window.showErrorMessage(ERROR, TRY_AGAIN, CANCEL)) === TRY_AGAIN;
			if (retry) {
				this._sessionOptions.forceNewSession = true;
				this._sessionOptions.createIfNone = false;
				this._sessionOptions.clearSessionPreference = true;
			}
		}
	}

	private async getSession(sessionOptions: vscode.AuthenticationGetSessionOptions): Promise<vscode.AuthenticationSession> {
		return await vscode.authentication.getSession(
			// Specifies the Microsoft Auth Provider
			'microsoft',
			// This GUID is the Azure DevOps GUID and you basically ask for a token that can be used to interact with AzDO. This is publicly documented all over
			['499b84ac-1321-427f-aa17-267ca6975798/.default', 'offline_access'],
			sessionOptions
		);
	}

	private async getToken(session: vscode.AuthenticationSession): Promise<string | undefined> {
		return session?.accessToken;
	}

	public getAuthenticatedUser(): Identity | undefined {
		return this._azdoAPI?.authenticatedUser;
	}

	dispose() {
		this._disposables.forEach(disposable => disposable.dispose());
	}
}
