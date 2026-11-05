export class AppError extends Error {
  public statusCode: number;
  public codigo?: string;

  constructor(message: string, statusCode: number = 400, codigo?: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.codigo = codigo;
  }
}
