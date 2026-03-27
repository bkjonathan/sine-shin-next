"use client";

import axios from "axios";
import { toast } from "sonner";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message: string =
      error.response?.data?.error ?? error.message ?? "Something went wrong";

    // Don't toast on 401 — handled by middleware redirect
    if (error.response?.status !== 401) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;
