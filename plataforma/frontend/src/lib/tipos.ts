export interface RecursosServidor {
  tipo: string
  vcpu: number
  memoria_gib: number
  disco_gb: number
}

export interface Plan {
  id: "basico" | "estandar" | "avanzado"
  nombre: string
  descripcion: string
  costo_dia_usd: number
  estudiantes: number
  app: RecursosServidor
  bd: {
    modo: "local" | "ec2" | "rds"
    tipo?: string
    clase?: string
    vcpu?: number
    memoria_gib?: number
    almacenamiento_gb: number
    version?: string
    respaldo_dias?: number
    descripcion: string
  }
}

export type EstadoTenant =
  | "creando"
  | "activo"
  | "suspendiendo"
  | "suspendido"
  | "reanudando"
  | "eliminando"
  | "eliminado"
  | "error"

export type EstadoOperacion = "pendiente" | "ejecutando" | "exitosa" | "fallida"

export interface Operacion {
  id: number
  tenant_id: string
  tipo: "crear" | "suspender" | "reanudar" | "eliminar"
  estado: EstadoOperacion
  error: string | null
  versiones: Record<string, string>
  reintento_de: number | null
  creada_en: string
  iniciada_en: string | null
  terminada_en: string | null
}

export interface Tenant {
  id: string
  institucion: string
  correo: string
  region: string
  entorno: string
  plan: Plan["id"]
  motor: "terraform" | "pulumi"
  admin_registro: string
  admin_nombre: string
  datos_demo: boolean
  estado: EstadoTenant
  url: string | null
  salidas: { instancias?: string[]; rds?: string; ami?: string; ip_publica?: string }
  creado_en: string
  actualizado_en: string
  ultima_operacion: Operacion | null
}

export interface LineaLog {
  id: number
  texto: string
  creada_en: string
}

export interface Opciones {
  regiones: string[]
  motores: { id: string; nombre: string }[]
  entornos: string[]
  grafana_url: string
}

export interface Recurso {
  tipo: string
  nombre: string
  arn: string
}

export interface Alerta {
  nombre: string
  tenant: string | null
  estado: string
  desde: string | null
  resumen: string | null
}
