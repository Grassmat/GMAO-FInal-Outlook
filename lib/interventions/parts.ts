import { database } from '../store';
import { AppError } from '../auth';
import type { PartUsage } from './types';

// Stock references are resolved on the server. User-provided names never identify a stock item.
export async function validatePartUsage(site: string, input: unknown, previous: PartUsage[] = []): Promise<PartUsage[]> {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 100) throw new AppError('Cent lignes de pièces maximum.');
  const seen = new Set<string>();
  const result: PartUsage[] = [];
  for (const line of input) {
    if (!line || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000000)
      throw new AppError('Chaque pièce doit avoir une quantité entière positive.');
    if (line.part === null) {
      if (typeof line.name !== 'string' || !line.name.trim() || line.name.length > 150 ||
          (line.reference !== undefined && (typeof line.reference !== 'string' || line.reference.length > 200)))
        throw new AppError('Indiquez le nom de la pièce non référencée (150 caractères maximum).');
      result.push({ part: null, name: line.name.trim(), reference: (line.reference || '').trim(), quantity: line.quantity });
      continue;
    }
    if (typeof line.part !== 'string' || !line.part || seen.has(line.part))
      throw new AppError('Sélectionnez chaque référence du stock une seule fois et ajustez sa quantité.');
    seen.add(line.part);
    const row = await database().prepare("SELECT site,data FROM records WHERE id=? AND kind='part'")
      .bind(line.part).first<{ site: string; data: string }>();
    if (!row || row.site !== site || (JSON.parse(row.data).deleted && !previous.some(p => p.part === line.part && p.quantity >= line.quantity))) throw new AppError('Cette pièce est absente ou supprimée du stock du site.', 403);
    const data = JSON.parse(row.data);
    result.push({ part: line.part, name: data.name, reference: data.reference || '', quantity: line.quantity });
  }
  return result;
}
