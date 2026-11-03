export interface AuthenticatedUser {
  email: string;
  id: string;
}

export interface JwtPayload {
  email: string;
  sub: string;
}

export interface AccessToken {
  accessToken: string;
}
