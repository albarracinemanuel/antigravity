# Analisis de compra MyA

Herramienta web para la consolidación y análisis de stock, ventas y mercadería pendiente por zonas geográficas (NOA, Buenos Aires, Córdoba).

## Características Principales

*   **Carga de Datos**: Soporte para archivos de Proveedores (.xls/.xlsx), Stock, Ventas y Pendientes (.csv).
*   **Análisis Dinámico**: Clasificación por zonas y cálculo automático de promedios y proyecciones.
*   **Clasificación ABC (Pareto)**:
    *   Clasifica los productos en **A (80%)**, **B (15%)** y **C (5%)** según su volumen de ventas.
    *   Indicadores visuales sutiles (Azul, Amarillo, Gris) para facilitar la lectura.
*   **Filtro de Fechas**:
    *   Permite seleccionar un rango de fechas específico para el análisis de ventas.
    *   Recalcula automáticamente promedios, categorías y sugerencias al cambiar el rango.
*   **Filtros Avanzados**:
    *   Por proveedor específico.
    *   **Alta Rotación**: Visualización exclusiva de productos de Categoría A.
    *   **Top 200**: Los 200 productos más vendidos.
*   **Exportación a Excel**: Descarga la tabla completa, incluyendo la nueva columna de Categoría, respetando los filtros y fechas seleccionadas.

## Instrucciones de Uso

1.  **Carga de Archivos**:
    *   Arrastre o seleccione los 4 archivos requeridos (Proveedores, Stock, Ventas, Pendientes).
    *   El sistema procesará automáticamente la información.

2.  **Configuración de Análisis**:
    *   **Fechas**: Verifique el rango "Desde" y "Hasta". Por defecto selecciona todo el historial disponible. Modifíquelo para analizar períodos específicos (ej: último mes, temporada anterior).
    *   **Meses Proyección**: Defina cuántos meses de stock desea cubrir (por defecto: 2).

3.  **Visualización**:
    *   Seleccione un Proveedor, "Top 200" o "**🔥 ALTA ROTACIÓN (CATEGORÍA A)**".
    *   La tabla mostrará:
        *   **Datos del Producto**: Código, Descripción y Categoría (A, B, C).
        *   **Datos por Zona**: Stock actual, Pendiente, Ventas (en el período seleccionado), Estimación de venta futura y **Sugerido de Compra**.

4.  **Interpretación de Resultados ("General")**:
    *   **Filas**:
        *   <span style="background-color: #eef5ff">Azul Claro</span>: Categoría A (Alta Rotación).
        *   <span style="background-color: #fff9e6">Amarillo Claro</span>: Categoría B (Rotación Media).
        *   <span style="background-color: #f5f5f5">Gris Claro</span>: Categoría C (Baja Rotación).
    *   **Sugerido**: Cantidad resaltada en azul indica una oportunidad de compra, calculada como: `(Venta Promedio * Meses Proy) - (Stock + Pendiente)`.

5.  **Análisis Eficiente (Pestaña "Eficiente")**:
    *   Este modo se activa seleccionando un **único proveedor**.
    *   **Objetivo**: Optimizar pedidos basándose en el "Punto de Pedido" (ROP) y Lead Time (tiempo de entrega).
    *   **¿Cómo funciona el Sugerido?**:
        *   El sistema verifica primero si **algún producto de Categoría A** está por debajo de su punto de reposición (ROP = Demanda en Lead Time + 10% seguridad).
        *   **Si se activa la alerta (Trigger)**: Se calculan sugeridos para *todos* los productos del proveedor para aprovechar el pedido.
        *   **Cálculos por Categoría**:
            *   **A**: Busca cubrir 2 meses de venta. `Sugerido = (Venta Mensual * 2) - Stock`.
            *   **B**: Busca cubrir 1.5 meses de venta. `Sugerido = (Venta Mensual * 1.5) - Stock`.
            *   **C**: Reposición puntual. Solo sugiere si hubo ventas recientes y falta stock.

6.  **Exportación**: use el botón "📊 Exportar a Excel" para guardar el análisis actual.

## Requisitos de Archivos

### 1. Proveedores (.xls / .xlsx)
*   Columnas: `cod_alfa`, `proveedor` (o `ult_provee`), `detalle`.

### 2. Stock, Ventas y Pendientes (.csv)
*   **Ventas**: `cod_alfa`, `nom_area`, `cantidad`, `fecha`.
*   **Stock**: `cod_alfa`, `nom_area`, `disponible`.
*   **Pendientes**: `cod_alfa`, `nom_area`, `pendiente`.

## Tecnologías
*   HTML5, CSS3, JavaScript (Vanilla).
*   Librerías: SheetJS (Excel), PapaParse (CSV).
