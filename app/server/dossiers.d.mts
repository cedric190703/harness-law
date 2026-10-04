// Déclarations pour le jeu de test. Le module est en JavaScript.

export type MetaDossier = {
  id: string; nom: string; operation: string; cible: string; cote: string;
  dateReference: string; ouvertLe: string; responsable: string; demonstration?: boolean;
  pieces: number; nombreAudits: number; dernierAudit: string | null; relus: number;
};
export type Travail = {
  relus: string[]; notes: Record<string, string>; corrections: Record<string, string>; modifieLe?: string;
};

export function identifiant(nom: string): string;
export function cheminDossier(id: string): string;
export function cheminPieces(id: string): string;
export function lister(): Promise<MetaDossier[]>;
export function charger(id: string): Promise<MetaDossier>;
export function creer(champs: Partial<MetaDossier>): Promise<MetaDossier>;
export function supprimer(id: string): Promise<void>;
export function verser(
  id: string,
  fichiers: { nom: string; contenu: string }[],
  lot?: string,
): Promise<{ lot: string; verses: { nom: string; octets?: number; dans?: string; refuse?: string }[] }>;
export function listerAudits(id: string): Promise<{ fichier: string; a: string; id: string; constats: number; pieces: number }[]>;
export function enregistrerAudit(id: string, audit: unknown): Promise<string>;
export function dernierAudit(id: string): Promise<unknown>;
export function auditPrecedent(id: string): Promise<unknown>;
export function lireTravail(id: string): Promise<Travail>;
export function ecrireTravail(id: string, partiel: Partial<Travail>): Promise<Travail>;
export function appliquerTravail<T>(audit: T, travail: Travail): T;
