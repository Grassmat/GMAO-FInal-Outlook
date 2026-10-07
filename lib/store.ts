import { env } from "cloudflare:workers";
export function database(){if(!env.DB)throw new Error("Base de données indisponible");return env.DB;}
