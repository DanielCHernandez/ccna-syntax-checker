/* ============================================================
   DRAFT: extended lab data for c1_pt_10.3_connect_router_to_lan
   Adds a full addressing table (including the pre-configured serial
   link and the 4 PCs, which the exercise itself doesn't grade but a
   topology diagram needs) and an explicit topology/connections
   object for the diagram to draw from.

   Source: verified directly against the real ITExamAnswers.net
   instructor-copy page for 10.3.4, cross-checked against the
   person's own live inspection of the actual Packet Tracer file
   (confirming the red/kinked line between R1-R2 is a serial
   connection, and the exact switch/PC fan-out on each side).
   ============================================================ */

// REPLACES the existing addressingTable in c1_pt_10.3_connect_router_to_lan.
// The two Gigabit rows per router are UNCHANGED from what's already in
// production (v1.35.0) -- only new rows were added (serial + PCs).
const addressingTable_DRAFT = [
  // --- R1: student-configured (this is what the exercise grades) ---
  { device: "R1", iface: "G0/0", ip: "192.168.10.1", mask: "255.255.255.0", gateway: "N/A" },
  { device: "R1", iface: "G0/1", ip: "192.168.11.1", mask: "255.255.255.0", gateway: "N/A" },
  // --- R1: pre-configured by the lab itself, not graded, but real
  // and needed for an accurate diagram ---
  { device: "R1", iface: "S0/0/0 (DCE)", ip: "209.165.200.225", mask: "255.255.255.252", gateway: "N/A" },

  // --- R2: student-configured ---
  { device: "R2", iface: "G0/0", ip: "10.1.1.1", mask: "255.255.255.0", gateway: "N/A" },
  { device: "R2", iface: "G0/1", ip: "10.1.2.1", mask: "255.255.255.0", gateway: "N/A" },
  // --- R2: pre-configured ---
  { device: "R2", iface: "S0/0/0", ip: "209.165.200.226", mask: "255.255.255.252", gateway: "N/A" },

  // --- End devices (not configured in this exercise at all -- shown
  // for topology/diagram completeness only, per the real lab's own
  // note: "the switches are not configured; you will not be able to
  // ping them") ---
  { device: "PC1", iface: "NIC", ip: "192.168.10.10", mask: "255.255.255.0", gateway: "192.168.10.1" },
  { device: "PC2", iface: "NIC", ip: "192.168.11.10", mask: "255.255.255.0", gateway: "192.168.11.1" },
  { device: "PC3", iface: "NIC", ip: "10.1.1.10", mask: "255.255.255.0", gateway: "10.1.1.1" },
  { device: "PC4", iface: "NIC", ip: "10.1.2.10", mask: "255.255.255.0", gateway: "10.1.2.1" }
];

// NEW: explicit connection/topology data for the diagram. Kept
// separate from addressingTable (rather than trying to derive
// connections from matching subnets) because that inference breaks
// down as soon as a topology has more than one link per subnet, or a
// link with no IP at all (e.g. an unconfigured switch-to-PC cable) --
// explicit is safer and clearer to read than clever.
//
// "kind" distinguishes link types for future rendering choices (e.g.
// a serial WAN link could be drawn differently from a LAN cable) --
// not required for a first static version, but cheap to include now
// so it doesn't need to be retrofitted later.
const topology_DRAFT = {
  devices: [
    { id: "R1", type: "router" },
    { id: "R2", type: "router" },
    { id: "S1", type: "switch" },
    { id: "S2", type: "switch" },
    { id: "S3", type: "switch" },
    { id: "S4", type: "switch" },
    { id: "PC1", type: "pc" },
    { id: "PC2", type: "pc" },
    { id: "PC3", type: "pc" },
    { id: "PC4", type: "pc" }
  ],
  connections: [
    // The one link between the two routers -- a WAN/serial link,
    // pre-configured by the lab, not something the student sets up.
    { from: "R1", fromIface: "S0/0/0 (DCE)", to: "R2", toIface: "S0/0/0", kind: "serial" },

    // R1's two LAN legs (these ARE the student's actual task).
    { from: "R1", fromIface: "G0/0", to: "S1", kind: "lan" },
    { from: "R1", fromIface: "G0/1", to: "S2", kind: "lan" },

    // R2's two LAN legs (also part of the student's task).
    { from: "R2", fromIface: "G0/0", to: "S3", kind: "lan" },
    { from: "R2", fromIface: "G0/1", to: "S4", kind: "lan" },

    // Switch-to-PC links -- present for a complete/accurate diagram,
    // even though these devices are never configured or graded.
    { from: "S1", to: "PC1", kind: "lan" },
    { from: "S2", to: "PC2", kind: "lan" },
    { from: "S3", to: "PC3", kind: "lan" },
    { from: "S4", to: "PC4", kind: "lan" }
  ]
};

/* ---------------------------------------------------------
   How this would slot into the existing lab object
   (c1_pt_10.3_connect_router_to_lan) in terminal-v1.35.0.html:

   {
     id: "c1_pt_10.3_connect_router_to_lan",
     label: "Course 1 · PacketTr · 10.3 — Connect a Router to a LAN",
     devices: [ ... unchanged ... ],
     addressingTable: addressingTable_DRAFT,   // <- replaces existing array
     topology: topology_DRAFT,                  // <- new field
     tasks: [ ... completely unchanged ... ]
   }

   Nothing about "devices" or "tasks" needs to change at all -- the
   student's actual checked task list is identical to what's already
   shipped. This is purely additive: more complete reference data for
   a new "Topology" button to read from, sitting alongside the
   existing addressing table and task list, not replacing anything
   the grading logic depends on.
   --------------------------------------------------------- */
