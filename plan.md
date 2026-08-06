# Estado Actual del Proyecto (Actualizado)

Se han completado y validado todas las correcciones solicitadas a lo largo de las sesiones recientes, abarcando la lógica de simulación, la interfaz gráfica, el modo oscuro y el informe documentado en LaTeX. 

## 🗂️ Estructura del Proyecto (Mapa de Archivos)

```text
sim-unificado/
├── index.html                         ← SPA completa (Estructura base UI)
├── plan.md                            ← Este documento de estado
├── css/
│   └── estilos.css                    ← Estilos completos (Incluyendo variables Dark Mode)
├── informe_final/
│   └── informe_final.tex              ← Documento LaTeX actualizado
└── js/
    ├── main.js                        ← Orquestador global de CPU+MEM
    ├── parser.js                      ← Parser de archivos (CSV/TXT)
    ├── planificadores/
    │   └── algoritmos.js              ← Algoritmos CPU (FCFS, SJF, RR, SRT)
    ├── memoria/
    │   └── algoritmos.js              ← Algoritmos RAM (First/Best/Worst Fit, Buddy System)
    ├── ui/
    │   ├── ganttRenderer.js           ← Renderizado Canvas del Diagrama Gantt
    │   ├── memRenderer.js             ← Renderizado del mapa de memoria HTML
    │   ├── metricsRenderer.js         ← Renderizado de métricas y tablas resumen
    │   ├── stepLog.js                 ← Bitácora de pasos y colas del planificador
    │   └── discoRenderer.js           ← Motor gráfico de la grilla del disco duro
    └── disco/
        ├── algoritmos.js              ← Lógica matemática: Contigua, Enlazada, FAT, Indexada, etc.
        └── mainDisco.js               ← Controlador y eventos del módulo de disco
```

---

## 📄 Estructura del Informe (LaTeX) — Versión Final

1. **Preliminares**
   - 1.1. Portada (📸 IMAGEN 1: Logo UNA)
   - 1.2. Índice General
   - 1.3. Índice de Figuras y Tablas
2. **Introducción y Objetivos**
   - 2.1. Introducción
   - 2.2. Objetivo General
   - 2.3. Objetivos Específicos
3. **Marco Teórico y Matemático** (Con Citas APA 7)
   - 3.1. Planificación de CPU
     - 3.1.1. Métricas de Evaluación de CPU (T_esp, T_ret, T_res, U, X)
     - 3.1.2. Algoritmos: FCFS, SJF, SRT, Round Robin
   - 3.2. Gestión de Memoria Principal
     - 3.2.1. Métricas de Evaluación de Memoria (U_m, F_int, F_ext, procesosAsignados)
     - 3.2.2. Algoritmos: First Fit, Best Fit, Worst Fit, Buddy System
   - 3.3. Asignación de Almacenamiento (Disco)
     - 3.3.1. Métricas de Evaluación de Disco (bloquesOcupados, bloquesLibres, archivosSet, O_d, T_a)
     - 3.3.2. Algoritmos: Contigua, Enlazada, Indexada, FAT, Multinivel, Extents, Bitmap
4. **Arquitectura y Diseño del Simulador**
   - 4.1. Tecnologías Base (JS, HTML5, Canvas)
   - 4.2. Estructura del Código
5. **Implementación Analítica en Código**
   - 5.1. Módulo de Disco (FAT)
   - 5.2. Módulo de Memoria (Buddy System)
6. **Manual de Pruebas y Resultados Experimentales**
   - 6.1. Entorno de Pruebas Común
   - 6.2. Resultados CPU (📸 IMÁGENES 3-7)
   - 6.3. Resultados Memoria (📸 IMÁGENES 8-10)
   - 6.4. Resultados Disco — 7 algoritmos (📸 IMÁGENES 11-17)
7. **Análisis de Rendimiento Comparativo**
   - 7.1. Consolidado CPU (tabla comparativa)
   - 7.2. Consolidado Memoria (tabla comparativa)
   - 7.3. Consolidado Disco (tabla comparativa)
8. **Conclusiones**
9. **Referencias** (APA 7, sangría francesa, artículos con URLs)

---

## Cambios Realizados

### Simulación de Disco
- Corrección de sincronización en `mainDisco.js`
- Dispersión aleatoria para Enlazada y FAT
- Fin de cadena `-1` en `discoRenderer.js`
- Bitácora mejorada con `bloquesAfectados`
- Cache-busting con versionado `?v=XXXXXX`

### Modo Oscuro (Dark Mode)
- Toggle con `localStorage`
- Corrección de colores fijos (`#fff`)
- Variables CSS dinámicas

### Informe LaTeX
- Métricas integradas dentro del Marco Teórico (3.1.1, 3.2.1, 3.3.1)
- Fórmulas matemáticas con ecuaciones LaTeX numeradas
- 10 referencias APA 7 con URLs
- Tablas comparativas para CPU, Memoria y Disco
