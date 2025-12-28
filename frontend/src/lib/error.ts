import { isAxiosError } from 'axios';

type ErrorPayload = {
    error?: string;
    message?: string;
};

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (isAxiosError<ErrorPayload | string>(error)) {
        const data = error.response?.data;
        if (typeof data === 'string') return data;
        if (data && typeof data === 'object') {
            return data.error || data.message || fallback;
        }
    }
    return fallback;
};
