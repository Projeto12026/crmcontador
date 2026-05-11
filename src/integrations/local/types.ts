/**
 * Tipagem do schema do banco financeiro local (Postgres self-hosted).
 *
 * Sao apenas as 7 tabelas financeiras + enums + RPC. As FKs para
 * clients/contracts foram REMOVIDAS porque essas tabelas vivem no Supabase
 * (a coluna client_id/contract_id continua existindo como UUID solto).
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LocalDatabase = {
  __InternalSupabase: {
    PostgrestVersion: '12.0';
  };
  public: {
    Tables: {
      account_categories: {
        Row: {
          created_at: string;
          group_number: number;
          id: string;
          name: string;
          parent_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          group_number: number;
          id: string;
          name: string;
          parent_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          group_number?: number;
          id?: string;
          name?: string;
          parent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_categories_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'account_categories';
            referencedColumns: ['id'];
          },
        ];
      };
      cash_flow_transactions: {
        Row: {
          account_id: string;
          classification: string | null;
          client_id: string | null;
          contract_id: string | null;
          created_at: string;
          credit_card_id: string | null;
          credit_invoice_id: string | null;
          date: string;
          description: string;
          due_date: string | null;
          expense: number | null;
          financial_account_id: string | null;
          future_expense: number | null;
          future_income: number | null;
          id: string;
          income: number | null;
          installment_group_id: string | null;
          installment_number: number | null;
          installment_total: number | null;
          notes: string | null;
          origin_destination: string;
          paid_by_company: boolean;
          paid_date: string | null;
          payment_method: string | null;
          recurrence_type: string | null;
          source: string;
          status: string;
          type: LocalDatabase['public']['Enums']['transaction_type'];
          updated_at: string;
          value: number;
        };
        Insert: {
          account_id: string;
          classification?: string | null;
          client_id?: string | null;
          contract_id?: string | null;
          created_at?: string;
          credit_card_id?: string | null;
          credit_invoice_id?: string | null;
          date: string;
          description: string;
          due_date?: string | null;
          expense?: number | null;
          financial_account_id?: string | null;
          future_expense?: number | null;
          future_income?: number | null;
          id?: string;
          income?: number | null;
          installment_group_id?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          notes?: string | null;
          origin_destination: string;
          paid_by_company?: boolean;
          paid_date?: string | null;
          payment_method?: string | null;
          recurrence_type?: string | null;
          source?: string;
          status?: string;
          type: LocalDatabase['public']['Enums']['transaction_type'];
          updated_at?: string;
          value: number;
        };
        Update: {
          account_id?: string;
          classification?: string | null;
          client_id?: string | null;
          contract_id?: string | null;
          created_at?: string;
          credit_card_id?: string | null;
          credit_invoice_id?: string | null;
          date?: string;
          description?: string;
          due_date?: string | null;
          expense?: number | null;
          financial_account_id?: string | null;
          future_expense?: number | null;
          future_income?: number | null;
          id?: string;
          income?: number | null;
          installment_group_id?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          notes?: string | null;
          origin_destination?: string;
          paid_by_company?: boolean;
          paid_date?: string | null;
          payment_method?: string | null;
          recurrence_type?: string | null;
          source?: string;
          status?: string;
          type?: LocalDatabase['public']['Enums']['transaction_type'];
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_flow_transactions_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'account_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_flow_transactions_financial_account_id_fkey';
            columns: ['financial_account_id'];
            isOneToOne: false;
            referencedRelation: 'financial_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cft_credit_card_fk';
            columns: ['credit_card_id'];
            isOneToOne: false;
            referencedRelation: 'credit_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cft_credit_invoice_fk';
            columns: ['credit_invoice_id'];
            isOneToOne: false;
            referencedRelation: 'credit_card_invoices';
            referencedColumns: ['id'];
          },
        ];
      };
      credit_cards: {
        Row: {
          brand: string | null;
          closing_day: number;
          color: string | null;
          created_at: string;
          credit_limit: number;
          due_day: number;
          financial_account_id: string;
          icon: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          brand?: string | null;
          closing_day: number;
          color?: string | null;
          created_at?: string;
          credit_limit?: number;
          due_day: number;
          financial_account_id: string;
          icon?: string | null;
          id?: string;
          updated_at?: string;
        };
        Update: {
          brand?: string | null;
          closing_day?: number;
          color?: string | null;
          created_at?: string;
          credit_limit?: number;
          due_day?: number;
          financial_account_id?: string;
          icon?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'credit_cards_financial_account_id_fkey';
            columns: ['financial_account_id'];
            isOneToOne: true;
            referencedRelation: 'financial_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      credit_card_invoices: {
        Row: {
          closing_date: string;
          created_at: string;
          credit_card_id: string;
          due_date: string;
          id: string;
          paid_date: string | null;
          payment_transaction_id: string | null;
          period_month: number;
          period_year: number;
          status: LocalDatabase['public']['Enums']['invoice_status'];
          total_value: number;
          updated_at: string;
        };
        Insert: {
          closing_date: string;
          created_at?: string;
          credit_card_id: string;
          due_date: string;
          id?: string;
          paid_date?: string | null;
          payment_transaction_id?: string | null;
          period_month: number;
          period_year: number;
          status?: LocalDatabase['public']['Enums']['invoice_status'];
          total_value?: number;
          updated_at?: string;
        };
        Update: {
          closing_date?: string;
          created_at?: string;
          credit_card_id?: string;
          due_date?: string;
          id?: string;
          paid_date?: string | null;
          payment_transaction_id?: string | null;
          period_month?: number;
          period_year?: number;
          status?: LocalDatabase['public']['Enums']['invoice_status'];
          total_value?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'credit_card_invoices_credit_card_id_fkey';
            columns: ['credit_card_id'];
            isOneToOne: false;
            referencedRelation: 'credit_cards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'credit_invoices_payment_tx_fk';
            columns: ['payment_transaction_id'];
            isOneToOne: false;
            referencedRelation: 'cash_flow_transactions';
            referencedColumns: ['id'];
          },
        ];
      };
      financial_accounts: {
        Row: {
          account_category_id: string | null;
          created_at: string;
          current_balance: number;
          id: string;
          initial_balance: number;
          name: string;
          type: LocalDatabase['public']['Enums']['financial_account_type'];
          updated_at: string;
        };
        Insert: {
          account_category_id?: string | null;
          created_at?: string;
          current_balance?: number;
          id?: string;
          initial_balance?: number;
          name: string;
          type: LocalDatabase['public']['Enums']['financial_account_type'];
          updated_at?: string;
        };
        Update: {
          account_category_id?: string | null;
          created_at?: string;
          current_balance?: number;
          id?: string;
          initial_balance?: number;
          name?: string;
          type?: LocalDatabase['public']['Enums']['financial_account_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_accounts_account_category_id_fkey';
            columns: ['account_category_id'];
            isOneToOne: true;
            referencedRelation: 'account_categories';
            referencedColumns: ['id'];
          },
        ];
      };
      financial_categories: {
        Row: {
          color: string | null;
          created_at: string;
          id: string;
          is_active: boolean | null;
          name: string;
          type: LocalDatabase['public']['Enums']['transaction_type'];
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean | null;
          name: string;
          type: LocalDatabase['public']['Enums']['transaction_type'];
        };
        Update: {
          color?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          type?: LocalDatabase['public']['Enums']['transaction_type'];
        };
        Relationships: [];
      };
      financial_transactions: {
        Row: {
          amount: number;
          category_id: string | null;
          client_id: string | null;
          contract_id: string | null;
          created_at: string;
          description: string;
          due_date: string;
          id: string;
          notes: string | null;
          paid_date: string | null;
          status: LocalDatabase['public']['Enums']['financial_status'];
          type: LocalDatabase['public']['Enums']['transaction_type'];
          updated_at: string;
        };
        Insert: {
          amount: number;
          category_id?: string | null;
          client_id?: string | null;
          contract_id?: string | null;
          created_at?: string;
          description: string;
          due_date: string;
          id?: string;
          notes?: string | null;
          paid_date?: string | null;
          status?: LocalDatabase['public']['Enums']['financial_status'];
          type: LocalDatabase['public']['Enums']['transaction_type'];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          client_id?: string | null;
          contract_id?: string | null;
          created_at?: string;
          description?: string;
          due_date?: string;
          id?: string;
          notes?: string | null;
          paid_date?: string | null;
          status?: LocalDatabase['public']['Enums']['financial_status'];
          type?: LocalDatabase['public']['Enums']['transaction_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'financial_transactions_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'financial_categories';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      compute_invoice_for_card: {
        Args: { p_card_id: string; p_purchase_date: string };
        Returns: {
          out_period_year: number;
          out_period_month: number;
          out_closing_date: string;
          out_due_date: string;
        }[];
      };
    };
    Enums: {
      transaction_type: 'income' | 'expense';
      financial_account_type: 'bank' | 'cash' | 'credit';
      financial_status: 'pending' | 'paid' | 'overdue' | 'cancelled';
      invoice_status: 'aberta' | 'fechada' | 'paga' | 'atrasada';
    };
    CompositeTypes: Record<string, never>;
  };
};
