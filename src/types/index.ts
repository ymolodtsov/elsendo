export interface Note {
  id: string;
  title: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface SharedNote {
  id: string;
  note_id: string;
  share_token: string;
  created_at: string;
  is_active: boolean;
}

export interface NoteInsert {
  title?: string | null;
  content: string;
}

export interface NoteUpdate {
  title?: string | null;
  content?: string;
  updated_at?: string;
}
