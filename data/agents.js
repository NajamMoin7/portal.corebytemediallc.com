/**
 * Staff who take orders in the portal.
 *
 * Everyone shares the single portal login, so the agent picker in the header
 * is how an order gets attributed to a person. The chosen name is saved on
 * every order, shown in the history and used for the per-agent totals.
 *
 * To add or rename someone, edit this list and redeploy. Names must be unique
 * and are compared exactly (case-sensitive) — renaming an agent will not
 * re-attribute their earlier orders.
 */
export const AGENTS = ['Haziq', 'Arham', 'Suzan'];

export function isValidAgent(name) {
  return AGENTS.includes(name);
}
