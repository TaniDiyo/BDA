import client from "./client";

export const authApi = {
  login: (credentials) => client.post("/auth/login", credentials),
  signup: (details) => client.post("/auth/signup", details),
  me: () => client.get("/auth/me"),
};

export default authApi;
