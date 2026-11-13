export class ApiError extends Error {
  status: number
  constructor(status: number) {
    super(`API request failed (${status})`)
    this.status = status
  }
}
