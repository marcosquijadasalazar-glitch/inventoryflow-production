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
      company_settings: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          email: string | null
          footer_notes: string | null
          id: string
          logo_url: string | null
          organization_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          footer_notes?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          footer_notes?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
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
      organizations: {
        Row: {
          active_status: boolean
          business_type: string | null
          company_name: string
          created_at: string
          id: string
          logo_url: string | null
          plan_type: Database["public"]["Enums"]["org_plan"]
          updated_at: string
        }
        Insert: {
          active_status?: boolean
          business_type?: string | null
          company_name: string
          created_at?: string
          id?: string
          logo_url?: string | null
          plan_type?: Database["public"]["Enums"]["org_plan"]
          updated_at?: string
        }
        Update: {
          active_status?: boolean
          business_type?: string | null
          company_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          plan_type?: Database["public"]["Enums"]["org_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
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
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_org: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "owner" | "manager" | "employee"
      movement_type: "add" | "remove" | "adjustment"
      org_plan: "free" | "starter" | "pro" | "enterprise"
      transaction_source: "manual" | "barcode_scan" | "adjustment" | "system"
      transaction_type:
        | "product_created"
        | "product_updated"
        | "product_deleted"
        | "stock_added"
        | "stock_removed"
        | "stock_adjusted"
        | "low_stock"
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
      app_role: ["super_admin", "owner", "manager", "employee"],
      movement_type: ["add", "remove", "adjustment"],
      org_plan: ["free", "starter", "pro", "enterprise"],
      transaction_source: ["manual", "barcode_scan", "adjustment", "system"],
      transaction_type: [
        "product_created",
        "product_updated",
        "product_deleted",
        "stock_added",
        "stock_removed",
        "stock_adjusted",
        "low_stock",
      ],
    },
  },
} as const
