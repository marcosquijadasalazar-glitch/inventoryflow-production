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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          metadata: Json | null
          new_status: string | null
          performed_by: string | null
          performed_by_email: string | null
          previous_status: string | null
          reason: string | null
          target_id: string
          target_label: string | null
          target_type: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          performed_by?: string | null
          performed_by_email?: string | null
          previous_status?: string | null
          reason?: string | null
          target_id: string
          target_label?: string | null
          target_type: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          performed_by?: string | null
          performed_by_email?: string | null
          previous_status?: string | null
          reason?: string | null
          target_id?: string
          target_label?: string | null
          target_type?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          business_type: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          currency: string | null
          email: string | null
          footer_notes: string | null
          id: string
          logo_url: string | null
          organization_id: string | null
          phone: string | null
          tax_id: string | null
          timezone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_type?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          footer_notes?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string | null
          phone?: string | null
          tax_id?: string | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_type?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          footer_notes?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string | null
          phone?: string | null
          tax_id?: string | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          note: string | null
          organization_id: string | null
          product_id: string
          quantity: number
          type: Database["public"]["Enums"]["movement_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string | null
          product_id: string
          quantity: number
          type: Database["public"]["Enums"]["movement_type"]
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string | null
          product_id?: string
          quantity?: number
          type?: Database["public"]["Enums"]["movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          node_level: string
          notes: string | null
          organization_id: string | null
          parent_id: string | null
          type: Database["public"]["Enums"]["location_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          node_level?: string
          notes?: string | null
          organization_id?: string | null
          parent_id?: string | null
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          node_level?: string
          notes?: string | null
          organization_id?: string | null
          parent_id?: string | null
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json
          organization_id: string
          read: boolean
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          organization_id: string
          read?: boolean
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          organization_id?: string
          read?: boolean
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          active_status: boolean
          archived_at: string | null
          business_type: string | null
          company_name: string
          created_at: string
          current_period_end: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          demo_data_installed: boolean
          enabled_modules: Json
          grace_period_ends_at: string | null
          has_used_trial: boolean
          id: string
          is_active: boolean
          is_trialing: boolean
          logo_url: string | null
          module_overrides_enabled: boolean
          onboarding_business_size: string | null
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          onboarding_dismissed: boolean
          onboarding_location_count: string | null
          onboarding_product_volume: string | null
          onboarding_started_at: string | null
          onboarding_step: number
          pending_plan: string | null
          plan_type: Database["public"]["Enums"]["org_plan"]
          setup_fee_paid: boolean
          setup_fee_paid_at: string | null
          setup_fee_plan: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          active_status?: boolean
          archived_at?: string | null
          business_type?: string | null
          company_name: string
          created_at?: string
          current_period_end?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          demo_data_installed?: boolean
          enabled_modules?: Json
          grace_period_ends_at?: string | null
          has_used_trial?: boolean
          id?: string
          is_active?: boolean
          is_trialing?: boolean
          logo_url?: string | null
          module_overrides_enabled?: boolean
          onboarding_business_size?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_dismissed?: boolean
          onboarding_location_count?: string | null
          onboarding_product_volume?: string | null
          onboarding_started_at?: string | null
          onboarding_step?: number
          pending_plan?: string | null
          plan_type?: Database["public"]["Enums"]["org_plan"]
          setup_fee_paid?: boolean
          setup_fee_paid_at?: string | null
          setup_fee_plan?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          active_status?: boolean
          archived_at?: string | null
          business_type?: string | null
          company_name?: string
          created_at?: string
          current_period_end?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          demo_data_installed?: boolean
          enabled_modules?: Json
          grace_period_ends_at?: string | null
          has_used_trial?: boolean
          id?: string
          is_active?: boolean
          is_trialing?: boolean
          logo_url?: string | null
          module_overrides_enabled?: boolean
          onboarding_business_size?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_dismissed?: boolean
          onboarding_location_count?: string | null
          onboarding_product_volume?: string | null
          onboarding_started_at?: string | null
          onboarding_step?: number
          pending_plan?: string | null
          plan_type?: Database["public"]["Enums"]["org_plan"]
          setup_fee_paid?: boolean
          setup_fee_paid_at?: string | null
          setup_fee_plan?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          bin_id: string | null
          category: string | null
          cost: number
          created_at: string
          id: string
          location: string | null
          min_stock: number
          name: string
          organization_id: string | null
          price: number
          sku: string
          stock: number
          supplier: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          bin_id?: string | null
          category?: string | null
          cost?: number
          created_at?: string
          id?: string
          location?: string | null
          min_stock?: number
          name: string
          organization_id?: string | null
          price?: number
          sku: string
          stock?: number
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          bin_id?: string | null
          category?: string | null
          cost?: number
          created_at?: string
          id?: string
          location?: string | null
          min_stock?: number
          name?: string
          organization_id?: string | null
          price?: number
          sku?: string
          stock?: number
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          archived_at: string | null
          business_type: string | null
          company_name: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          must_change_password: boolean
          organization_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          suspended_at: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          archived_at?: string | null
          business_type?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          suspended_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          archived_at?: string | null
          business_type?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          suspended_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          barcode: string | null
          id: string
          line_total: number
          product_id: string | null
          product_name: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          sku: string | null
          unit_cost: number
        }
        Insert: {
          barcode?: string | null
          id?: string
          line_total?: number
          product_id?: string | null
          product_name?: string | null
          purchase_order_id: string
          quantity_ordered?: number
          quantity_received?: number
          sku?: string | null
          unit_cost?: number
        }
        Update: {
          barcode?: string | null
          id?: string
          line_total?: number
          product_id?: string | null
          product_name?: string | null
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          sku?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string | null
          organization_id: string | null
          po_number: string
          received_date: string | null
          status: Database["public"]["Enums"]["po_status"]
          subtotal: number
          supplier_id: string | null
          tax: number
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          organization_id?: string | null
          po_number: string
          received_date?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          supplier_id?: string | null
          tax?: number
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          organization_id?: string | null
          po_number?: string
          received_date?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          supplier_id?: string | null
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          organization_id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          organization_id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          organization_id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      sales_order_items: {
        Row: {
          barcode: string | null
          id: string
          line_total: number
          margin: number
          product_id: string | null
          product_name: string | null
          quantity: number
          sales_order_id: string
          sku: string | null
          unit_cost: number
          unit_price: number
        }
        Insert: {
          barcode?: string | null
          id?: string
          line_total?: number
          margin?: number
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          sales_order_id: string
          sku?: string | null
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          barcode?: string | null
          id?: string
          line_total?: number
          margin?: number
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          sales_order_id?: string
          sku?: string | null
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          new_status: string | null
          notes: string | null
          organization_id: string | null
          payment_date: string
          payment_method: string
          performed_by: string | null
          performed_by_email: string | null
          previous_status: string | null
          sales_order_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          new_status?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_date?: string
          payment_method: string
          performed_by?: string | null
          performed_by_email?: string | null
          previous_status?: string | null
          sales_order_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          new_status?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_date?: string
          payment_method?: string
          performed_by?: string | null
          performed_by_email?: string | null
          previous_status?: string | null
          sales_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_payments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          amount_paid: number
          balance_due: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount: number
          fulfilled_date: string | null
          id: string
          inventory_deducted_at: string | null
          inventory_reversed_at: string | null
          notes: string | null
          order_date: string | null
          organization_id: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          so_number: string
          status: Database["public"]["Enums"]["so_status"]
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          amount_paid?: number
          balance_due?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          fulfilled_date?: string | null
          id?: string
          inventory_deducted_at?: string | null
          inventory_reversed_at?: string | null
          notes?: string | null
          order_date?: string | null
          organization_id?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          so_number: string
          status?: Database["public"]["Enums"]["so_status"]
          subtotal?: number
          tax?: number
          total?: number
        }
        Update: {
          amount_paid?: number
          balance_due?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          fulfilled_date?: string | null
          id?: string
          inventory_deducted_at?: string | null
          inventory_reversed_at?: string | null
          notes?: string | null
          order_date?: string | null
          organization_id?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          so_number?: string
          status?: Database["public"]["Enums"]["so_status"]
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_sessions: {
        Row: {
          consumed_at: string | null
          created_at: string
          email: string
          organization_id: string | null
          plan: string
          session_id: string
          status: string
          temp_password: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          email: string
          organization_id?: string | null
          plan: string
          session_id: string
          status?: string
          temp_password?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          email?: string
          organization_id?: string | null
          plan?: string
          session_id?: string
          status?: string
          temp_password?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      transaction_history: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          new_stock: number | null
          organization_id: string | null
          previous_stock: number | null
          product_id: string | null
          product_name: string | null
          quantity_change: number | null
          reason: string | null
          sku: string | null
          source: Database["public"]["Enums"]["transaction_source"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          new_stock?: number | null
          organization_id?: string | null
          previous_stock?: number | null
          product_id?: string | null
          product_name?: string | null
          quantity_change?: number | null
          reason?: string | null
          sku?: string | null
          source?: Database["public"]["Enums"]["transaction_source"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          new_stock?: number | null
          organization_id?: string | null
          previous_stock?: number | null
          product_id?: string | null
          product_name?: string | null
          quantity_change?: number | null
          reason?: string | null
          sku?: string | null
          source?: Database["public"]["Enums"]["transaction_source"]
          type?: Database["public"]["Enums"]["transaction_type"]
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_order_items: {
        Row: {
          barcode: string | null
          id: string
          product_id: string | null
          product_name: string | null
          quantity: number
          sku: string | null
          transfer_order_id: string
        }
        Insert: {
          barcode?: string | null
          id?: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          sku?: string | null
          transfer_order_id: string
        }
        Update: {
          barcode?: string | null
          id?: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          sku?: string | null
          transfer_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_order_items_transfer_order_id_fkey"
            columns: ["transfer_order_id"]
            isOneToOne: false
            referencedRelation: "transfer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_orders: {
        Row: {
          completed_date: string | null
          created_at: string
          created_by: string | null
          from_location: string | null
          from_location_id: string | null
          id: string
          notes: string | null
          organization_id: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_location: string | null
          to_location_id: string | null
          transfer_date: string | null
          transfer_number: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          from_location?: string | null
          from_location_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_location?: string | null
          to_location_id?: string | null
          transfer_date?: string | null
          transfer_number: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          from_location?: string | null
          from_location_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_location?: string | null
          to_location_id?: string | null
          transfer_date?: string | null
          transfer_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_orders_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_orders_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          organization_id: string
          permission: Database["public"]["Enums"]["app_permission"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted: boolean
          id?: string
          organization_id: string
          permission: Database["public"]["Enums"]["app_permission"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          organization_id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_permissions: { Args: { _org_id: string }; Returns: boolean }
      current_user_org: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      is_module_enabled: { Args: { _module: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      org_plan_usage: {
        Args: { _org_id: string }
        Returns: {
          max_locations: number
          max_products: number
          max_users: number
          plan: Database["public"]["Enums"]["org_plan"]
          used_locations: number
          used_products: number
          used_users: number
        }[]
      }
      plan_limits: {
        Args: { _plan: Database["public"]["Enums"]["org_plan"] }
        Returns: {
          max_locations: number
          max_products: number
          max_users: number
        }[]
      }
      plan_modules: {
        Args: { _plan: Database["public"]["Enums"]["org_plan"] }
        Returns: Json
      }
    }
    Enums: {
      account_status:
        | "pending_approval"
        | "trial_active"
        | "active"
        | "suspended"
        | "cancelled"
        | "rejected"
      app_permission:
        | "view_dashboard"
        | "view_products"
        | "create_products"
        | "edit_products"
        | "delete_products"
        | "view_costs"
        | "view_prices"
        | "view_movements"
        | "create_movements"
        | "adjust_stock"
        | "view_transaction_history"
        | "export_data"
        | "view_reports"
        | "manage_purchase_orders"
        | "manage_sales_orders"
        | "record_payments"
        | "manage_transfer_orders"
        | "manage_internal_use"
        | "use_barcode_scanner"
        | "manage_alerts"
        | "manage_locations"
        | "manage_users"
        | "manage_company_settings"
        | "print_labels"
      app_role: "super_admin" | "owner" | "manager" | "employee"
      location_type: "warehouse" | "store" | "shelf" | "bin" | "truck" | "other"
      movement_type: "add" | "remove" | "adjustment"
      notification_type:
        | "low_stock"
        | "payment_failed"
        | "trial_ending"
        | "user_created"
        | "role_changed"
        | "system"
      org_plan: "free" | "starter" | "pro" | "enterprise"
      payment_status: "unpaid" | "paid" | "partial" | "refunded"
      po_status:
        | "draft"
        | "ordered"
        | "partially_received"
        | "received"
        | "cancelled"
      so_status: "draft" | "confirmed" | "fulfilled" | "cancelled" | "refunded"
      transaction_source:
        | "manual"
        | "barcode_scan"
        | "adjustment"
        | "system"
        | "internal_use"
      transaction_type:
        | "product_created"
        | "product_updated"
        | "product_deleted"
        | "stock_added"
        | "stock_removed"
        | "stock_adjusted"
        | "low_stock"
      transfer_status: "draft" | "in_transit" | "completed" | "cancelled"
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
      account_status: [
        "pending_approval",
        "trial_active",
        "active",
        "suspended",
        "cancelled",
        "rejected",
      ],
      app_permission: [
        "view_dashboard",
        "view_products",
        "create_products",
        "edit_products",
        "delete_products",
        "view_costs",
        "view_prices",
        "view_movements",
        "create_movements",
        "adjust_stock",
        "view_transaction_history",
        "export_data",
        "view_reports",
        "manage_purchase_orders",
        "manage_sales_orders",
        "record_payments",
        "manage_transfer_orders",
        "manage_internal_use",
        "use_barcode_scanner",
        "manage_alerts",
        "manage_locations",
        "manage_users",
        "manage_company_settings",
        "print_labels",
      ],
      app_role: ["super_admin", "owner", "manager", "employee"],
      location_type: ["warehouse", "store", "shelf", "bin", "truck", "other"],
      movement_type: ["add", "remove", "adjustment"],
      notification_type: [
        "low_stock",
        "payment_failed",
        "trial_ending",
        "user_created",
        "role_changed",
        "system",
      ],
      org_plan: ["free", "starter", "pro", "enterprise"],
      payment_status: ["unpaid", "paid", "partial", "refunded"],
      po_status: [
        "draft",
        "ordered",
        "partially_received",
        "received",
        "cancelled",
      ],
      so_status: ["draft", "confirmed", "fulfilled", "cancelled", "refunded"],
      transaction_source: [
        "manual",
        "barcode_scan",
        "adjustment",
        "system",
        "internal_use",
      ],
      transaction_type: [
        "product_created",
        "product_updated",
        "product_deleted",
        "stock_added",
        "stock_removed",
        "stock_adjusted",
        "low_stock",
      ],
      transfer_status: ["draft", "in_transit", "completed", "cancelled"],
    },
  },
} as const
