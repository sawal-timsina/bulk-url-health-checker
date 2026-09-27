export class TransientHttpError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly responseTimeMs: number,
    public readonly title: string | null,
  ) {
    super(message);
    this.name = "TransientHttpError";
  }
}
