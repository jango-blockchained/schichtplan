declare module 'bun:test' {
    export const describe: (name: string, fn: () => void) => void;
    export const it: (name: string, fn: () => void | Promise<void>) => void;
    export const expect: any;
    export const beforeAll: (fn: () => void | Promise<void>) => void;
    export const afterAll: (fn: () => void | Promise<void>) => void;
    export const beforeEach: (fn: () => void | Promise<void>) => void;
    export const afterEach: (fn: () => void | Promise<void>) => void;
    export const mock: <T extends (...args: any[]) => any>(implementation?: T) => jest.Mock<ReturnType<T>, Parameters<T>>;
    export const spyOn: <T extends object, K extends keyof T>(object: T, method: K) => jest.SpyInstance;
}

declare namespace jest {
    interface Mock<T = any, Y extends any[] = any> {
        (...args: Y): T;
        mockImplementation(fn: (...args: Y) => T): this;
        mockReturnValue(value: T): this;
        mockReturnThis(): this;
        mockResolvedValue(value: T): this;
        mockRejectedValue(value: any): this;
        mockClear(): this;
        mockReset(): this;
        mockRestore(): this;
        getMockName(): string;
        mock: {
            calls: Y[];
            results: { type: string; value: T }[];
            instances: T[];
            contexts: any[];
            lastCall: Y;
        };
    }

    interface SpyInstance extends Mock {
        mockRestore(): void;
        mockImplementation(fn: (...args: any[]) => any): this;
    }
} 