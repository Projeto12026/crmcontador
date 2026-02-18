export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_categories: {
        Row: {
          created_at: string
          group_number: number
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_number: number
          id: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_number?: number
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "account_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_flow_transactions: {
        Row: {
          account_id: string
          client_id: string | null
          contract_id: string | null
          created_at: string
          date: string
          description: string
          expense: number | null
          financial_account_id: string | null
          future_expense: number | null
          future_income: number | null
          id: string
          income: number | null
          notes: string | null
          origin_destination: string
          paid_by_company: boolean
          source: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          value: number
        }
        Insert: {
          account_id: string
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          date: string
          description: string
          expense?: number | null
          financial_account_id?: string | null
          future_expense?: number | null
          future_income?: number | null
          id?: string
          income?: number | null
          notes?: string | null
          origin_destination: string
          paid_by_company?: boolean
          source?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          value: number
        }
        Update: {
          account_id?: string
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          date?: string
          description?: string
          expense?: number | null
          financial_account_id?: string | null
          future_expense?: number | null
          future_income?: number | null
          id?: string
          income?: number | null
          notes?: string | null
          origin_destination?: string
          paid_by_company?: boolean
          source?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_flow_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_flow_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_flow_transactions_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean | null
          name: string
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["onboarding_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["onboarding_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["onboarding_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding_items: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          is_completed: boolean | null
          notes: string | null
          onboarding_id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          onboarding_id: string
          order_index: number
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          onboarding_id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_items_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "client_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          acquisition_source:
            | Database["public"]["Enums"]["acquisition_channel"]
            | null
          address: string | null
          city: string | null
          created_at: string
          document: string | null
          document_type: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          status: Database["public"]["Enums"]["client_status"]
          trading_name: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          acquisition_source?:
            | Database["public"]["Enums"]["acquisition_channel"]
            | null
          address?: string | null
          city?: string | null
          created_at?: string
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          trading_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          acquisition_source?:
            | Database["public"]["Enums"]["acquisition_channel"]
            | null
          address?: string | null
          city?: string | null
          created_at?: string
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          trading_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      contract_services: {
        Row: {
          contract_id: string
          created_at: string
          description: string | null
          id: string
          service_name: string
          value: number | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          description?: string | null
          id?: string
          service_name: string
          value?: number | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          description?: string | null
          id?: string
          service_name?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_services_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          billing_day: number | null
          client_id: string | null
          client_name: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          manager: string | null
          monthly_value: number | null
          notes: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          tax_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          billing_day?: number | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          manager?: string | null
          monthly_value?: number | null
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          tax_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          billing_day?: number | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          manager?: string | null
          monthly_value?: number | null
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          tax_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cora_boletos: {
        Row: {
          cnpj: string
          competencia_ano: number | null
          competencia_mes: number | null
          cora_invoice_id: string
          created_at: string
          due_date: string | null
          empresa_id: string | null
          id: string
          paid_at: string | null
          raw_json: Json | null
          status: string
          synced_at: string
          total_amount_cents: number | null
        }
        Insert: {
          cnpj: string
          competencia_ano?: number | null
          competencia_mes?: number | null
          cora_invoice_id: string
          created_at?: string
          due_date?: string | null
          empresa_id?: string | null
          id?: string
          paid_at?: string | null
          raw_json?: Json | null
          status?: string
          synced_at?: string
          total_amount_cents?: number | null
        }
        Update: {
          cnpj?: string
          competencia_ano?: number | null
          competencia_mes?: number | null
          cora_invoice_id?: string
          created_at?: string
          due_date?: string | null
          empresa_id?: string | null
          id?: string
          paid_at?: string | null
          raw_json?: Json | null
          status?: string
          synced_at?: string
          total_amount_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cora_boletos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "cora_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cora_config: {
        Row: {
          chave: string
          updated_at: string
          valor: Json | null
        }
        Insert: {
          chave: string
          updated_at?: string
          valor?: Json | null
        }
        Update: {
          chave?: string
          updated_at?: string
          valor?: Json | null
        }
        Relationships: []
      }
      cora_empresas: {
        Row: {
          client_id: string | null
          client_name: string | null
          cnpj: string
          created_at: string
          dia_vencimento: number | null
          email: string | null
          forma_envio: string | null
          id: string
          is_active: boolean | null
          observacoes: string | null
          telefone: string | null
          updated_at: string
          valor_mensal: number | null
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          cnpj: string
          created_at?: string
          dia_vencimento?: number | null
          email?: string | null
          forma_envio?: string | null
          id?: string
          is_active?: boolean | null
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          valor_mensal?: number | null
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          cnpj?: string
          created_at?: string
          dia_vencimento?: number | null
          email?: string | null
          forma_envio?: string | null
          id?: string
          is_active?: boolean | null
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          valor_mensal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cora_empresas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cora_envios: {
        Row: {
          boleto_id: string | null
          canal: string | null
          competencia_ano: number | null
          competencia_mes: number | null
          created_at: string
          detalhe: string | null
          empresa_id: string | null
          id: string
          sucesso: boolean | null
        }
        Insert: {
          boleto_id?: string | null
          canal?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          created_at?: string
          detalhe?: string | null
          empresa_id?: string | null
          id?: string
          sucesso?: boolean | null
        }
        Update: {
          boleto_id?: string | null
          canal?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          created_at?: string
          detalhe?: string | null
          empresa_id?: string | null
          id?: string
          sucesso?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "cora_envios_boleto_id_fkey"
            columns: ["boleto_id"]
            isOneToOne: false
            referencedRelation: "cora_boletos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cora_envios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "cora_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cora_message_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          message_body: string
          name: string
          template_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          message_body: string
          name: string
          template_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          message_body?: string
          name?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_accounts: {
        Row: {
          account_category_id: string | null
          created_at: string
          current_balance: number
          id: string
          initial_balance: number
          name: string
          type: Database["public"]["Enums"]["financial_account_type"]
          updated_at: string
        }
        Insert: {
          account_category_id?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          name: string
          type: Database["public"]["Enums"]["financial_account_type"]
          updated_at?: string
        }
        Update: {
          account_category_id?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          name?: string
          type?: Database["public"]["Enums"]["financial_account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_account_category_id_fkey"
            columns: ["account_category_id"]
            isOneToOne: true
            referencedRelation: "account_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          category_id: string | null
          client_id: string | null
          contract_id: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_date: string | null
          status: Database["public"]["Enums"]["financial_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["financial_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["financial_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          completed_at: string | null
          created_at: string
          description: string
          id: string
          lead_id: string
          scheduled_at: string | null
        }
        Insert: {
          activity_type: string
          completed_at?: string | null
          created_at?: string
          description: string
          id?: string
          lead_id: string
          scheduled_at?: string | null
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          lead_id?: string
          scheduled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          acquisition_channel:
            | Database["public"]["Enums"]["acquisition_channel"]
            | null
          company_name: string
          contact_name: string | null
          converted_client_id: string | null
          created_at: string
          email: string | null
          expected_value: number | null
          id: string
          lost_reason: string | null
          notes: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          acquisition_channel?:
            | Database["public"]["Enums"]["acquisition_channel"]
            | null
          company_name: string
          contact_name?: string | null
          converted_client_id?: string | null
          created_at?: string
          email?: string | null
          expected_value?: number | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          acquisition_channel?:
            | Database["public"]["Enums"]["acquisition_channel"]
            | null
          company_name?: string
          contact_name?: string | null
          converted_client_id?: string | null
          created_at?: string
          email?: string | null
          expected_value?: number | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_investments: {
        Row: {
          created_at: string
          id: string
          month: string
          notes: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          notes?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          notes?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_template_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_index: number
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_index: number
          template_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll_obligations: {
        Row: {
          client_cnpj: string
          client_id: string | null
          client_name: string
          client_status: string
          competence: string
          completed_at: string | null
          created_at: string
          department: string
          due_date: string | null
          gclick_id: string | null
          id: string
          notes: string | null
          obligation_name: string
          status: string
          updated_at: string
        }
        Insert: {
          client_cnpj: string
          client_id?: string | null
          client_name: string
          client_status?: string
          competence: string
          completed_at?: string | null
          created_at?: string
          department?: string
          due_date?: string | null
          gclick_id?: string | null
          id?: string
          notes?: string | null
          obligation_name?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_cnpj?: string
          client_id?: string | null
          client_name?: string
          client_status?: string
          competence?: string
          completed_at?: string | null
          created_at?: string
          department?: string
          due_date?: string | null
          gclick_id?: string | null
          id?: string
          notes?: string | null
          obligation_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_obligations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_proposal_items: {
        Row: {
          created_at: string
          department: string
          department_hourly_cost: number | null
          hourly_rate: number
          hours_per_month: number
          id: string
          monthly_value: number
          notes: string | null
          proposal_id: string
          service_catalog_id: string | null
          service_name: string
          service_type: string | null
        }
        Insert: {
          created_at?: string
          department?: string
          department_hourly_cost?: number | null
          hourly_rate?: number
          hours_per_month?: number
          id?: string
          monthly_value?: number
          notes?: string | null
          proposal_id: string
          service_catalog_id?: string | null
          service_name: string
          service_type?: string | null
        }
        Update: {
          created_at?: string
          department?: string
          department_hourly_cost?: number | null
          hourly_rate?: number
          hours_per_month?: number
          id?: string
          monthly_value?: number
          notes?: string | null
          proposal_id?: string
          service_catalog_id?: string | null
          service_name?: string
          service_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "pricing_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_proposal_items_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "pricing_service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_proposals: {
        Row: {
          client_id: string | null
          client_name: string | null
          company_type: string | null
          complexity_score: number | null
          created_at: string
          fiscal_complexity: string | null
          has_digital_certificate: boolean | null
          hourly_cost: number
          id: string
          markup_civil_liability: number | null
          markup_interest: number | null
          markup_pdd: number | null
          markup_percentage: number
          markup_profit: number | null
          markup_taxes: number | null
          monthly_revenue: number | null
          notes: string | null
          num_branches: number | null
          num_employees: number | null
          num_monthly_invoices: number | null
          revenue_bracket: string | null
          sellable_hours_month: number | null
          status: string
          tax_regime: string | null
          total_monthly_value: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          company_type?: string | null
          complexity_score?: number | null
          created_at?: string
          fiscal_complexity?: string | null
          has_digital_certificate?: boolean | null
          hourly_cost?: number
          id?: string
          markup_civil_liability?: number | null
          markup_interest?: number | null
          markup_pdd?: number | null
          markup_percentage?: number
          markup_profit?: number | null
          markup_taxes?: number | null
          monthly_revenue?: number | null
          notes?: string | null
          num_branches?: number | null
          num_employees?: number | null
          num_monthly_invoices?: number | null
          revenue_bracket?: string | null
          sellable_hours_month?: number | null
          status?: string
          tax_regime?: string | null
          total_monthly_value?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          company_type?: string | null
          complexity_score?: number | null
          created_at?: string
          fiscal_complexity?: string | null
          has_digital_certificate?: boolean | null
          hourly_cost?: number
          id?: string
          markup_civil_liability?: number | null
          markup_interest?: number | null
          markup_pdd?: number | null
          markup_percentage?: number
          markup_profit?: number | null
          markup_taxes?: number | null
          monthly_revenue?: number | null
          notes?: string | null
          num_branches?: number | null
          num_employees?: number | null
          num_monthly_invoices?: number | null
          revenue_bracket?: string | null
          sellable_hours_month?: number | null
          status?: string
          tax_regime?: string | null
          total_monthly_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_service_catalog: {
        Row: {
          additional_employee_value: number | null
          created_at: string
          default_hours_per_month: number
          department: string
          description: string | null
          id: string
          included_employees: number | null
          is_active: boolean
          name: string
          service_type: string
          updated_at: string
        }
        Insert: {
          additional_employee_value?: number | null
          created_at?: string
          default_hours_per_month?: number
          department?: string
          description?: string | null
          id?: string
          included_employees?: number | null
          is_active?: boolean
          name: string
          service_type?: string
          updated_at?: string
        }
        Update: {
          additional_employee_value?: number | null
          created_at?: string
          default_hours_per_month?: number
          department?: string
          description?: string | null
          id?: string
          included_employees?: number | null
          is_active?: boolean
          name?: string
          service_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      process_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          notes: string | null
          order_index: number
          process_id: string
          status: Database["public"]["Enums"]["process_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          order_index: number
          process_id: string
          status?: Database["public"]["Enums"]["process_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_index?: number
          process_id?: string
          status?: Database["public"]["Enums"]["process_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_steps_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_steps: {
        Row: {
          created_at: string
          description: string | null
          estimated_days: number | null
          id: string
          name: string
          order_index: number
          template_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_days?: number | null
          id?: string
          name: string
          order_index: number
          template_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_days?: number | null
          id?: string
          name?: string
          order_index?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      processes: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["process_status"]
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["process_status"]
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["process_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          enabled_views: string[] | null
          id: string
          is_focus_list: boolean | null
          is_frog: boolean | null
          is_important: boolean | null
          is_urgent: boolean | null
          ivy_lee_order: number | null
          priority: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          enabled_views?: string[] | null
          id?: string
          is_focus_list?: boolean | null
          is_frog?: boolean | null
          is_important?: boolean | null
          is_urgent?: boolean | null
          ivy_lee_order?: number | null
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          enabled_views?: string[] | null
          id?: string
          is_focus_list?: boolean | null
          is_frog?: boolean | null
          is_important?: boolean | null
          is_urgent?: boolean | null
          ivy_lee_order?: number | null
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      acquisition_channel:
        | "whatsapp"
        | "social_media"
        | "website_form"
        | "referral"
        | "direct_prospecting"
        | "google_ads"
        | "events"
        | "other"
        | "google_my_business"
        | "site"
      app_role: "admin" | "finance" | "user"
      client_status: "active" | "inactive" | "blocked"
      contract_status:
        | "draft"
        | "active"
        | "suspended"
        | "cancelled"
        | "expired"
      financial_account_type: "bank" | "cash" | "credit"
      financial_status: "pending" | "paid" | "overdue" | "cancelled"
      forma_envio: "EMAIL" | "WHATSAPP"
      lead_status:
        | "prospecting"
        | "contact"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      onboarding_status: "pending" | "in_progress" | "completed"
      priority_level: "low" | "medium" | "high" | "urgent"
      process_status:
        | "pending"
        | "in_progress"
        | "awaiting_docs"
        | "awaiting_client"
        | "completed"
        | "cancelled"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
      transaction_type: "income" | "expense"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acquisition_channel: [
        "whatsapp",
        "social_media",
        "website_form",
        "referral",
        "direct_prospecting",
        "google_ads",
        "events",
        "other",
        "google_my_business",
        "site",
      ],
      app_role: ["admin", "finance", "user"],
      client_status: ["active", "inactive", "blocked"],
      contract_status: ["draft", "active", "suspended", "cancelled", "expired"],
      financial_account_type: ["bank", "cash", "credit"],
      financial_status: ["pending", "paid", "overdue", "cancelled"],
      forma_envio: ["EMAIL", "WHATSAPP"],
      lead_status: [
        "prospecting",
        "contact",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      onboarding_status: ["pending", "in_progress", "completed"],
      priority_level: ["low", "medium", "high", "urgent"],
      process_status: [
        "pending",
        "in_progress",
        "awaiting_docs",
        "awaiting_client",
        "completed",
        "cancelled",
      ],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
