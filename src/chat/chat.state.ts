import { ExtensionContext } from 'vscode';

class Expirable<T> {
	constructor(public value: T, private expiration: Date) {}

	get isExpired() {
		return this.expiration < new Date();
	}
}

export class StateManager {
	constructor(private context: ExtensionContext) {}

	private nextExpirationDate() {
		const expiration = new Date();
		expiration.setHours(24, 0, 0, 0);
		return expiration;
	}

	setValue<T>(key: string, value: T) {
		this.context.workspaceState.update(key, new Expirable(value, this.nextExpirationDate()));
	}

	getValue<T>(key: string) {
		const expirable = this.context.workspaceState.get<Expirable<T>>(key);
		if (expirable !== undefined && !expirable.isExpired) {
			return expirable.value;
		}
		return null;
	}

	getOrCreateValue<T>(key: string, createValue: () => T) {
		const value = this.getValue<T>(key);
		if (value !== null) {
			return value;
		}
		const newValue = createValue();
		this.setValue(key, newValue);
		return newValue;
	}

	async getOrCreateValueAsync<T>(key: string, createValue: () => Promise<T>) {
		const value = this.getValue<T>(key);
		if (value !== null) {
			return value;
		}
		const newValue = await createValue();
		this.setValue(key, newValue);
		return newValue;
	}
}
