export class RequestException extends Error {
    public statusCode: number;
    public headers: Headers | undefined;

    constructor(message: string, statusCode: number, headers?: Headers) {
        super(message);
        this.name = 'RequestException';
        this.statusCode = statusCode;
        this.headers = headers;
    }

    getHeader (name: string) {
        return this.headers?.get(name) ?? undefined;
    }
}