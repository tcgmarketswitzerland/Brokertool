/**
 * Platzhalter, bis das Supabase-Projekt verbunden ist. Danach erzeugt
 * `pnpm db:types` die Datei database.generated.ts aus dem echten Schema und
 * dieser Typ verweist darauf.
 *
 * Die Struktur folgt dem, was supabase-js als GenericSchema erwartet -
 * inklusive Relationships bei Tabellen und einer echten Views-Form. Weicht
 * sie davon ab, faellt der Typ stillschweigend auf undefined zurueck und
 * jeder rpc-Aufruf verliert seine Pruefung, ohne dass es auffaellt.
 *
 * Die Datenbankfunktionen sind von Hand deklariert, weil der Anwendungscode
 * sie bereits aufruft: lieber eine gepflegte Handschrift als ein `any`, das
 * den ersten Tippfehler im Parameternamen durchlaesst.
 */

/** JSON, wie Postgres es annimmt - fuer jsonb-Parameter. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

type Row = Record<string, unknown>;

type Table = {
  Row: Row;
  Insert: Row;
  Update: Row;
  Relationships: [];
};

type View = {
  Row: Row;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: Record<string, Table>;
    Views: Record<string, View>;
    Functions: {
      create_organization: {
        Args: { p_name: string; p_display_name?: string | null };
        Returns: string;
      };
      accept_invitation: {
        Args: { p_token: string };
        Returns: string;
      };
      switch_organization: {
        Args: { p_organization_id: string };
        Returns: undefined;
      };
      expire_invitations: {
        Args: Record<string, never>;
        Returns: number;
      };
      start_advice_session: {
        Args: { p_customer_id: string; p_title?: string | null };
        Returns: string;
      };
      session_bootstrap: {
        Args: Record<string, never>;
        Returns: { has_membership: boolean; claim_org: string | null };
      };
      complete_advice_session: {
        Args: { p_session_id: string; p_document: Json };
        Returns: string;
      };
    };
    Enums: {
      org_role: 'OWNER' | 'ADMIN' | 'ADVISOR' | 'BACKOFFICE';
      invitation_status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type OrgRole = Database['public']['Enums']['org_role'];
