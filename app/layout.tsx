import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"GMAO · Maintenance",description:"Gestion de maintenance multi-sites"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}
