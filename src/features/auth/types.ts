export type AuthUser = {
  id: number
  email: string
  displayName: string
  pictureUrl: string | null
}

export type AuthResponse = {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: AuthUser
}
