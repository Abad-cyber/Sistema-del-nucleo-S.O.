# 🖥️ Simulador Unificado — Planificación CPU + Gestión de Memoria

Simulador académico interactivo que une en una sola interfaz los algoritmos de planificación de CPU y de gestión de memoria, con visualización dinámica y sincronizada.

---

## 🚀 Cómo ejecutar

> ⚠️ El proyecto usa módulos ES6 (`import/export`). **No abrir directamente** como archivo `file://`.

### Opción A — VS Code Live Server (recomendado)
1. Abrir la carpeta `sim-unificado/` en VS Code.
2. Instalar la extensión **Live Server** (Ritwick Dey) si no la tienes.
3. Clic derecho en `index.html` → **Open with Live Server**.
4. Se abre en `http://127.0.0.1:5500`.

### Opción B — Python
```bash
cd sim-unificado
python -m http.server 8080
# Abrir: http://localhost:8080
```

### Opción C — Node.js
```bash
npx serve sim-unificado
```

---

## 📁 Estructura del proyecto

```
sim-unificado/
├── index.html                        ← Interfaz principal (SPA de 3 páginas)
├── README.md                         ← Este archivo
├── css/
│   └── estilos.css                   ← Sistema de diseño y estilos globales
└── js/
    ├── main.js                       ← Orquestador principal
    ├── parser.js                     ← Parseo de CSV/TXT y tabla manual
    ├── planificadores/
    │   └── algoritmos.js             ← FCFS, SJF, Round Robin, SRT
    ├── memoria/
    │   └── algoritmos.js             ← First Fit, Best Fit, Worst Fit, Buddy System
    └── ui/
        ├── memRenderer.js            ← Mapa de memoria vertical
        ├── ganttRenderer.js          ← Diagrama de Gantt (canvas HTML5)
        ├── metricsRenderer.js        ← Stat-boxes y tablas de resultados
        └── stepLog.js                ← Log narrativo de pasos de memoria
```

---

## 📋 Formato del archivo de entrada

```
proceso, llegada, ejecucion, tamaño_KB
P1, 0, 5, 50
P2, 1, 3, 5
P3, 2, 8, 80
P4, 3, 2, 15
P5, 4, 5, 50
P6, 5, 12, 200
```

- Separadores: coma `,`, punto y coma `;` o tabulación.
- Las líneas que empiezan con `#` o `//` son comentarios (se ignoran).
- El encabezado es opcional.

---

## ⚙️ Algoritmos implementados

### Planificación de CPU
| Algoritmo | Tipo | Descripción |
|-----------|------|-------------|
| FCFS | No expulsivo | Orden de llegada |
| SJF  | No expulsivo | Menor ráfaga primero |
| RR   | Expulsivo    | Quantum configurable |
| SRT  | Expulsivo    | SJF con expulsión en cada tick |

### Gestión de Memoria
| Algoritmo   | Descripción |
|-------------|-------------|
| First Fit   | Primer hueco suficiente |
| Best Fit    | Hueco más pequeño suficiente |
| Worst Fit   | Hueco más grande disponible |
| Buddy System| Potencias de 2, fusión de gemelos |

---

## 🖱️ Uso de la interfaz

1. **Parámetros**: Cargar archivo o editar la tabla de procesos. Seleccionar algoritmos y configurar parámetros. Pulsar **Ejecutar Simulación**.
2. **Gráfica**: Ver el diagrama de Gantt y el mapa de memoria animados y sincronizados. Usar los controles de velocidad, pausa y paso a paso.
3. **Tablas**: Ver las tablas completas de métricas de CPU y de gestión de memoria.

---

## ⚙️ Algoritmos implementados