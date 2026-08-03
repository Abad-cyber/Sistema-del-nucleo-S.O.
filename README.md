# SimuKernel — Simulador Unificado CPU, Memoria y Disco

Simulador académico interactivo que integra planificación de procesos (CPU), gestión de memoria principal y **asignación de espacio en disco**, con visualización dinámica y sincronizada paso a paso.

---

## Requisitos

Requiere servidor HTTP (módulos ES6). No abrir como `file://`.

```bash
# Python
cd sim-unificado && python -m http.server 8080

# Node.js
npx serve sim-unificado

# VS Code Live Server
clic derecho en index.html → Open with Live Server
```

---

## Módulos del Simulador

### 1. Algoritmos de CPU
- **FCFS** — First Come, First Served (no expropiativo)
- **SJF** — Shortest Job First (no expropiativo)
- **RR** — Round Robin con quantum configurable
- **SRT** — Shortest Remaining Time (expropiativo)

### 2. Algoritmos de Memoria
- **First Fit** — Asigna en el primer hueco que cumple
- **Best Fit** — Asigna en el hueco más ajustado
- **Worst Fit** — Asigna en el hueco más grande
- **Buddy System** — Asigna en bloques de tamaño potencia de 2 con splitting/merging
* Políticas de partición: **Dinámica** (bloques variables) y **Fija** (tamaños definidos por el usuario).

### 3. Asignación de Espacio en Disco (Nuevo)
- **Contigua** — Asigna bloques físicos consecutivos.
- **Enlazada** — Bloques dispersos unidos por punteros internos.
- **Indexada** — Un bloque índice centraliza los punteros de datos.
- **FAT (Tabla de Asignación)** — Variación de enlazada con los punteros extraídos a una tabla externa en memoria.
- **Indexada Multi-Nivel** — Árbol jerárquico de índices (raíz, nivel 1, nivel 2) para archivos de gran tamaño.
- **Extensiones (Extents)** — Agrupación masiva de bloques contiguos indicando (inicio, longitud).
- **Mapa de Bits (Bitmap)** — Escaneo y gestión de espacio libre a nivel binario.
* Modalidades soportadas: **Manual** (el usuario define punteros exactos) y **Automática** (el kernel escanea y asigna libremente el espacio).

---

## Formato de Entrada

**Para CPU/Memoria:**
`P1, 0, 5, 50` (Nombre, Llegada, Ejecución, TamañoKB)

**Para Disco (Automático):**
`App1, 15` (Nombre, Bloques requeridos)

**Para Disco (Manual):**
Depende del algoritmo (secuencias de punteros, jerarquías de índices, pares de extensiones, etc.). Ver la tabla de ayuda interactiva dentro del simulador.

Separadores aceptados: `,` `;` o tabulación. Las líneas que inician con `#` o `//` se ignoran.

---

## Funcionamiento

1. **Página Parámetros** — Carga archivos de prueba (TXT) o ingresa datos manualmente. Configura los algoritmos, capacidades y políticas según el módulo a evaluar (CPU/Mem, o Disco).
2. **Página Gráfica** — Visualización en tiempo real. Reproduce las simulaciones paso a paso (adelante/atrás) o mediante AutoPlay. Observa el diagrama de Gantt, mapas de memoria y cuadrículas de disco interactuando simultáneamente.
3. **Página Tablas / Resultados** — Monitorea métricas consolidadas: tiempos de espera (CPU), fragmentación externa y operaciones E/S (Disco), y tablas de asignación de archivos y directorios.

---

## Estructura del Proyecto (Resumen)

```text
sim-unificado/
├── index.html                     ← Interfaz principal y navegación
├── css/estilos.css                ← Hojas de estilo e interfaces UI/UX
├── js/
│   ├── main.js                    ← Orquestador y control de simulaciones
│   ├── parser.js                  ← Lector de archivos de entrada
│   ├── memoria/algoritmos.js      ← Lógicas de gestión de memoria
│   ├── planificadores/algoritmos.js ← Lógicas de CPU
│   ├── disco/
│   │   ├── mainDisco.js           ← Controlador de las vistas de disco
│   │   └── algoritmos.js          ← Métodos avanzados (FAT, Extents, Bitmap, etc.)
│   └── ui/
│       ├── discoRenderer.js       ← Motor de renderizado visual 3D/Grillas para disco
│       ├── memRenderer.js         ← Gráficas de memoria y bloques
│       ├── ganttRenderer.js       ← Gráfica temporal del procesador
│       └── metricsRenderer.js     ← Paneles de métricas y bitácoras
├── procesos/                      ← Set de datos de prueba preconfigurados
├── informe_latex2/                ← Reporte del análisis técnico en LaTeX
└── README.md
```

---

## Licencia

Uso académico. Proyecto educativo desarrollado para el curso de Sistemas Operativos.
