export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}
