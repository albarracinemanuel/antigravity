# Gestión de Stock por Zonas

Herramienta web para la consolidación y análisis de stock, ventas y mercadería pendiente por zonas geográficas (NOA, Buenos Aires, Córdoba).

## Características

- **Carga de Datos**: Permite cargar 4 archivos clave:
  1.  **Proveedores** (.xls/.xlsx): Base de datos de productos y proveedores.
  2.  **Stock del Día** (.csv): Reporte de stock actual por depósito.
  3.  **Ventas Planas** (.csv): Histórico de ventas.
  4.  **Mercadería Pendiente** (.csv): Productos en tránsito o pendientes de recepción.

- **Análisis Automático**:
  - Clasificación automática de zonas (NOA, Buenos Aires, Córdoba).
  - Cálculo de ventas promedio mensuales.
  - Proyección de stock necesario.
  - **Sugerencia de Compra**: Fórmula inteligente que considera ventas estimadas, stock actual y mercadería pendiente.

- **Filtrado Exclusivo**:
  - Análisis por proveedor específico.
  - Visualización del "Top 200" productos más vendidos globalmente.

- **Exportación**:
  - **Exportar a Excel**: Descarga la tabla de análisis resultante en formato `.xlsx` para su uso offline.

## Instrucciones de Uso

1.  Abra el archivo `index.html` en su navegador web (Chrome, Edge, Firefox).
2.  **Cargue los archivos requeridos** en las zonas correspondientes:
    - Arrastre y suelte los archivos o haga clic en los botones de carga.
    - Asegúrese de que los archivos CSV tengan los encabezados correctos (ver abajo).
3.  Una vez cargados los 4 archivos, aparecerá el selector de proveedores.
4.  **Seleccione un proveedor** o la opción "Top 200".
5.  Ajuste los "Meses de Proyección" si es necesario.
6.  Analice la tabla de resultados:
    - **Stock**: Rojo si es crítico, Naranja si hay exceso.
    - **Sug. (Sugerido)**: Cantidad recomendada a comprar (Resaltado en azul).
7.  **Exportar**: Haga clic en el botón verde "📊 Exportar a Excel" para descargar el reporte visualizado.

## Requisitos de Archivos

### 1. Proveedores (.xls / .xlsx)
Columnas necesarias:
- `cod_alfa`: Código del producto.
- `proveedor` (o `ult_provee`): Nombre del proveedor.
- `detalle`: Descripción del producto.

### 2. Stock, Ventas y Pendientes (.csv)
Deben ser archivos delimitados por comas o punto y coma.
Columnas necesarias:
- `cod_alfa`: Código del producto.
- `nom_area`: Nombre del depósito o sucursal (para determinar la zona).
- `cantidad` (Ventas), `disponible` (Stock) o `pendiente` (Pendientes).
- `fecha` (Solo para Ventas): Para calcular el rango de meses analizado.

## Tecnologías

- HTML5 / CSS3
- JavaScript (Vanilla)
- [SheetJS](https://sheetjs.com/) (Lectura/Escritura Excel)
- [PapaParse](https://www.papaparse.com/) (Lectura CSV)
