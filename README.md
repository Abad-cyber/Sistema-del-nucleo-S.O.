# SimuKernel — Simulador Unificado CPU + Memoria

Simulador académico interactivo que integra planificación de CPU y gestión de memoria, con visualización dinámica y sincronizada paso a paso.

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

## Algoritmos de CPU

- **FCFS** — First Come, First Served (no expropiativo)
- **SJF** — Shortest Job First (no expropiativo)
- **RR** — Round Robin con quantum configurable
- **SRT** — Shortest Remaining Time (expropiativo)

## Algoritmos de Memoria

- **First Fit** — Asigna en el primer hueco que cumple
- **Best Fit** — Asigna en el hueco más ajustado
- **Worst Fit** — Asigna en el hueco más grande
- **Buddy System** — Asigna en bloques de tamaño potencia de 2 con splitting/merging

## Políticas de Partición

- **Dinámica** — Bloques variables según necesidad (FF/BF/WF/Buddy)
- **Fija** — Particiones de tamaño fijo definidas por el usuario

---

## Formato de Entrada

```
P1, 0, 5, 50
P2, 1, 3, 30
```

Columnas: `Nombre, Llegada, Ejecución, TamañoKB`

Separadores: `,` `;` o tabulación. Líneas con `#` o `//` se ignoran.

---

## Funcionamiento

1. **Página Parámetros** — Carga archivo CSV o edita la tabla manual. Selecciona algoritmos de CPU y memoria, quantum, memoria total, reserva para SO y política de particiones.

2. **Página Gráfica** — Visualiza el diagrama de Gantt (CPU) y el mapa de memoria sincronizados. Navega paso a paso con Avanzar/Retroceder o usa AutoPlay.

3. **Página Tablas** — Muestra métricas detalladas por proceso: tiempos de espera, retorno y respuesta (CPU), y asignación por partición con direcciones de inicio y fin (memoria).

---

## Estructura del Proyecto

```
sim-unificado/
├── index.html                     ← Página principal (3 vistas)
├── css/estilos.css                ← Estilos completos (~770 líneas)
├── js/
│   ├── main.js                    ← Orquestador, eventos, simulación
│   ├── parser.js                  ← Parseo de archivos y tabla manual
│   ├── memoria/algoritmos.js      ← First/Best/Worst Fit, Buddy System
│   ├── planificadores/algoritmos.js   ← FCFS, SJF, Round Robin, SRT
│   └── ui/
│       ├── memRenderer.js         ← Renderizado del mapa de memoria
│       ├── ganttRenderer.js       ← Renderizado del diagrama de Gantt
│       ├── metricsRenderer.js     ← Métricas, tablas de resultados
│       └── stepLog.js             ← Log de pasos y colas de procesos
├── procesos_5.txt .. _100.txt     ← Datos de prueba (5 a 100 procesos)
└── README.md
```

---

## Notas Técnicas

- **Buddy System** requiere que la memoria libre inicial sea potencia de 2. Si no lo es, se redondea hacia abajo y se notifica en consola.
- Las particiones fijas se definen como lista separada por comas (ej: `100,200,50`).
- La simulación puede inspeccionarse paso a paso en la vista Gráfica.

---

## Licencia

Uso académico. Proyecto educativo para la materia de Sistemas Operativos.
