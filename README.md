🔪 The Jackfruit Problem: Real-Time Deformable Mesh Cutting
===========================================================

**A real-time physics simulation of deformable cloth with dynamic topology modification, built from scratch using Three.js and custom Position-Based Dynamics (PBD).**

📖 Overview
-----------

This project was developed as part of the **Augmented and Virtual Reality (UE25CS342AA5)** course at PES University. The "Jackfruit Problem" challenges students to develop a system that simulates the cutting of a deformable mesh (such as skin or cloth) with realistic physical behavior.

Instead of relying on pre-built physics engines like Ammo.js or Cannon.js, this project implements a **custom physics engine** to handle the complex requirements of real-time topology modification (cutting) and structural stability.

🚀 Key Features
---------------

-   **Custom Physics Engine:** Built using **Position-Based Dynamics (PBD)** and **Verlet Integration** for high stability and performance.

-   **Dynamic Topology Modification:** The mesh is not just visually hidden; it is geometrically sliced in real-time. Vertices are duplicated and topology is rebuilt to create physical separation along the cut line.

-   **Realistic Fabric Behavior:** Implements **Shear Constraints** (diagonal springs) to simulate the structural integrity of woven fabric, preventing the "jelly-like" behavior common in simple mass-spring systems.

-   **Interactive Controls:** Full mouse interaction for dragging/pulling the cloth and a dedicated "Cutting Mode" for slicing.

-   **Visual Fidelity:** Supports texture mapping with a toggleable wireframe view to visualize the underlying triangulation changes during a cut.

🧠 Technical Architecture
-------------------------

### The Pivot: Volumetric vs. Surface Proxy

Our initial research proposed modeling the object as a **volumetric composite** with internal layers (Skin, Fat, Muscle) to simulate anatomical cutting. However, simulating volumetric cutting (Tetrahedralization) is computationally prohibitive for a real-time web application running at 60 FPS.

We pivoted to a **Surface-Based Physics Proxy** architecture. This approach, widely used in AAA games and surgical simulators, simulates a high-fidelity surface that acts as a proxy for the underlying mass. This optimization allows us to allocate our computational budget to the complex **Mesh Slicing** and **Topology Rebuilding** algorithms, ensuring a smooth, interactive experience without sacrificing visual realism.

### The Physics Solver

The simulation runs on a custom PBD solver that iterates 8 times per frame. It uses **Semi-Implicit Euler Integration** to calculate particle positions based on the difference between current and previous states, ensuring the simulation remains stable even when the mesh is aggressively torn or cut.

🎮 Controls
-----------

-   **Left Click + Drag:** Grab and pull the cloth (Physics Interaction).

-   **Spacebar:** Toggle **Cutting Mode**.

    -   *While in Cutting Mode:* **Right Click + Drag** to draw a cut line. Release to slice the mesh.

-   **T:** Toggle between **Texture** and **Wireframe** view (useful for debugging cuts).

-   **Arrow Keys:** Rotate the camera around the mesh.

🛠️ Installation & Setup
------------------------

This project uses modern JavaScript modules. Due to browser security restrictions on loading local files (textures), you must run it using a local server.

1.  **Clone the repository:**

    Bash

    ```
    git clone https://github.com/yourusername/jackfruit-problem.git
    cd jackfruit-problem

    ```

2.  **Install Dependencies:**

    Bash

    ```
    npm install

    ```

3.  **Run with a Local Server:**

    -   If using VS Code, install the **Live Server** extension and click "Go Live" at the bottom right.

    -   Or using Python: `python -m http.server`

    -   Or using Node: `npx vite`

4.  **Open in Browser:** Navigate to `http://localhost:5500` (or your server's port).

📄 Course Details
-----------------

-   **University:** PES University, Bangalore

-   **Course:** Augmented and Virtual Reality (UE25CS342AA5)

-   **Semester:** 5th Semester

-   **Problem Statement:** Jackfruit Problem (Real-time deformable mesh cutting)
