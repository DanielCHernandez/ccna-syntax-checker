
/* ============================================================
   CCNA CLI Engine — v1.35.0 (single self-contained file)
   ------------------------------------------------------------
   NEW in this version:
     - New IOS mode: line_config, entered via "line console 0"
       or "line vty 0 15" from global_config OR interface_config
       (matches real IOS behavior).
     - New commands: disable, line console 0, line vty 0 15,
       interface vlan 1, password <pw>, login (in line_config).
     - Exercise engine: guided step-by-step practice modeled on
       NetAcad's Syntax Checker, with a graduated hint ladder:
         attempts 1-2 wrong -> bare "not quite" message
         attempt 3 wrong    -> concept/mode-level hint
         attempt 4+ wrong   -> exact expected command shown,
                                student still must type it in
       (matches the escalation rule agreed for this version).
     - Dual-mode UI: Guided Practice (instruction-driven,
       checked steps) vs Free Practice (open CLI, no grading).
       Device state (hostname, interfaces, lines, mode) is
       SHARED and persists across both modes and across
       switching exercises, by design.
     - Module dropdown lists every planned exercise; ones
       without built commands yet show as "(coming soon)" and
       cannot be selected.
   ============================================================ */

const IOS_ENGINE_VERSION = "1.35.0";

/* ---------------------------------------------------------
   1. DEVICE STATE
   --------------------------------------------------------- */

/* ---------------------------------------------------------
   DEVICE MODELS
   ------------------------------------------------------------
   Real Cisco devices have a fixed, model-specific interface
   inventory present from boot — every interface exists (in an
   unconfigured/administratively-down state) whether or not a
   student has ever typed "interface <name>" for it. Before this
   version, our engine only knew about an interface once a human
   had explicitly entered it, meaning things like "show interfaces"
   (bare) or a genuinely-untouched-but-real interface's detail view
   could never work correctly — verified as a real gap via a live
   router capture (v1.11.1) showing GigabitEthernet0/1 and
   Serial0/0/0 listed even though neither was ever configured.

   This is also deliberately structured as a foundation for future
   multi-device work: a Device is now a self-contained object with
   a real identity (deviceType + its interface inventory), so a
   future topology holding multiple Device instances is a natural
   extension rather than a rewrite.
   --------------------------------------------------------- */

const DEVICE_MODELS = {
  // v1.35.0 correction: originally matched the Cisco 1941 (2-segment
  // names, GigabitEthernet0/0) seen in the 10.1 and 17.5/ISPRouter
  // real captures. Real bug found in testing: our OWN exercises
  // 10.2, 16.4, and 17.5's actual configuration steps all use
  // 3-segment ISR4000-style names (GigabitEthernet0/0/0), which
  // don't match the 2-segment fixed inventory — a student configuring
  // GigabitEthernet0/0/0 ended up with SEVEN interfaces total (5 from
  // the fixed inventory + 2 new "unknown" ones auto-created by
  // getOrCreateInterface's fallback), not the real 5. This reflects
  // a genuine inconsistency in the underlying ground-truth reference
  // material itself — different real Cisco router models were
  // captured for different labs. Since 3 of 5 router exercises
  // (10.2, 16.4, 17.5) actually configure 3-segment names, and 10.1
  // (the 2-segment source) never references a physical interface
  // name in any of its steps at all, the shared single-router model
  // now uses 3-segment ISR4000-style naming to match the majority of
  // what our exercises actually configure.
  router: {
    interfaces: ["GigabitEthernet0/0/0", "GigabitEthernet0/0/1", "Serial0/0/0", "Serial0/0/1", "Vlan1"]
  },
  // Standard Cisco 2960-style access switch — 24 FastEthernet access
  // ports, 2 GigabitEthernet uplinks, plus the Vlan1 management SVI.
  switch: {
    interfaces: (function () {
      const list = [];
      for (let i = 1; i <= 24; i++) list.push("FastEthernet0/" + i);
      list.push("GigabitEthernet0/1", "GigabitEthernet0/2", "Vlan1");
      return list;
    })()
  }
};

// The default shape for a brand-new, never-configured interface.
// Shared by createDevice() (initial inventory) and
// getOrCreateInterface() (lazy fallback for anything outside the
// model's known inventory, e.g. a free-form/unusual interface name),
// so the two can never drift into inconsistent defaults.
// defaultUp: true for switch physical access ports, which real IOS
// brings up administratively by default — CONFIRMED (not guessed) via
// two independent ground-truth Syntax Checker scripts (11.1 and 3.2)
// that configure switch ports and expect them to show as up/
// Secure-up WITHOUT ever running "no shutdown". Router physical
// interfaces, and EVERY device's Vlan/SVI interfaces (confirmed via
// many real router/switch captures showing "Vlan1 ...
// administratively down" even on switches), still correctly default
// to down — this only changes the default for switch physical ports.
function freshInterfaceState(defaultUp) {
  return {
    ip: null, mask: null, shutdown: !defaultUp,
    ipv6Address: null, ipv6PrefixLength: null, ipv6LinkLocal: null,
    switchportMode: null,   // null | "access" | "trunk"
    accessVlan: null,       // VLAN ID this access port belongs to (default 1 if in access mode, unset)
    trunkNativeVlan: null,  // set via "switchport trunk native vlan <id>"
    trunkAllowedVlans: null, // set via "switchport trunk allowed vlan <list>" — array of ints, null = "all"
    portSecurityEnabled: false,      // set via "switchport port-security"
    portSecurityMax: 1,              // real IOS default is 1 — set via "switchport port-security maximum <n>"
    portSecurityViolation: "shutdown", // real IOS default — set via "switchport port-security violation <mode>"
    portSecurityStickyEnabled: false,  // set via "switchport port-security mac-address sticky" (bare)
    portSecurityStickyMacs: [],        // manually-specified sticky MACs via "switchport port-security mac-address sticky <mac>"
    dot1qVlan: null,        // set via "encapsulation dot1Q <id>" — only meaningful on a subinterface
    dot1qNative: false,     // set true if "encapsulation dot1Q <id> native" was used
    helperAddress: null,    // set via "ip helper-address <ip>" — DHCP relay target
    ipv6OtherConfigFlag: false, // set via "ipv6 nd other-config-flag" (stateless DHCPv6, O-flag)
    ipv6ManagedConfigFlag: false, // set via "ipv6 nd managed-config-flag" (stateful DHCPv6, M-flag)
    ipv6DhcpServerPool: null,   // set via "ipv6 dhcp server <pool-name>"
    ospfPriority: 1,          // real IOS default is 1 — set via "ip ospf priority <n>"
    ospfHelloInterval: 10,    // real IOS default (seconds) — set via "ip ospf hello-interval <n>"
    ospfDeadInterval: 40,     // real IOS default (seconds) — set via "ip ospf dead-interval <n>"
    ospfMd5KeyId: null,       // set via "ip ospf message-digest-key <id> md5 <key>"
    ospfMd5Key: null,
    ospfMd5AuthEnabled: false, // set via "ip ospf authentication message-digest"
    inboundAccessList: null,   // set via "ip access-group <n|name> in"
    outboundAccessList: null,  // set via "ip access-group <n|name> out"
    natRole: null,              // null | "inside" | "outside" — set via "ip nat inside"/"ip nat outside"
    lldpTransmit: false,        // set via "lldp transmit"
    lldpReceive: false          // set via "lldp receive"
  };
}

// Given a device type and an interface name, returns whether that
// specific interface should default to administratively UP at
// creation. Only true for a switch's physical access ports
// (FastEthernet/GigabitEthernet) — NOT Vlan/SVI interfaces (which
// default down on every device type, confirmed via real captures),
// and not applicable to routers at all (their physical interfaces
// correctly default down, confirmed via many real router captures).
function defaultsUpAtCreation(deviceType, name) {
  return deviceType === "switch" && !/^Vlan/i.test(name);
}

// True if a name looks like a subinterface (contains a "." followed
// by digits, e.g. "GigabitEthernet0/0.10"). Subinterfaces are
// dynamically created (like VLANs) rather than part of a device's
// fixed physical inventory — a router doesn't have a fixed set of
// possible subinterfaces the way it has a fixed set of physical
// ports, so there's no DEVICE_MODELS entry for these; they're created
// on first "interface <phys>.<n>" the same way getOrCreateInterface
// already creates anything not in the fixed inventory.
function isSubinterfaceName(name) {
  return /\.\d+$/.test(name);
}

// Returns the physical parent interface name for a subinterface
// ("GigabitEthernet0/0.10" -> "GigabitEthernet0/0"), or the name
// itself if it's not a subinterface.
function parentInterfaceName(name) {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? name : name.slice(0, idx);
}

// Real switches present 5 default VLANs from boot, unconfigured —
// confirmed via a real Packet Tracer capture (v1.35.0): our
// ground-truth reference script's expected output only listed VLAN 1
// plus whatever the student created, but the real capture also showed
// 1002-1005 (legacy FDDI/Token Ring default VLANs every Cisco switch
// carries by default). These cannot be deleted or renamed by a
// student in any exercise built so far, so they're just baked into
// the initial VLAN table rather than tracked as "configurable."
function freshVlanTable() {
  return {
    1: { name: "default", status: "active" },
    1002: { name: "fddi-default", status: "active" },
    1003: { name: "token-ring-default", status: "active" },
    1004: { name: "fddinet-default", status: "active" },
    1005: { name: "trnet-default", status: "active" }
  };
}

function createDevice(hostname, deviceType) {
  if (hostname === undefined) hostname = "Switch";
  if (deviceType === undefined) deviceType = "switch";
  const model = DEVICE_MODELS[deviceType] || DEVICE_MODELS.switch;
  const interfaces = {};
  for (let i = 0; i < model.interfaces.length; i++) {
    const ifName = model.interfaces[i];
    interfaces[ifName] = freshInterfaceState(defaultsUpAtCreation(deviceType, ifName));
  }
  return {
    hostname: hostname,
    deviceType: deviceType,
    mode: "user_exec",
    currentInterface: null,
    currentLine: null,
    currentVlan: null,       // set when inside vlan_config mode
    currentDhcpPool: null,   // set when inside dhcp_pool_config mode
    currentIpv6DhcpPool: null, // set when inside ipv6_dhcp_pool_config mode
    currentExtAcl: null, // set when inside ext_nacl_config mode
    interfaces: interfaces,
    lines: {},
    vlans: freshVlanTable(),
    staticRoutes: [], // { network, mask, nextHop, adminDistance } — see "ip route" command
    dhcpExcludedRanges: [], // [{ start, end }] — see "ip dhcp excluded-address"
    dhcpPools: {}, // name -> { network, mask, defaultRouter, dnsServer, domainName }
    ipv6DhcpPools: {}, // name -> { addressPrefix, dnsServer, domainName } — see "ipv6 dhcp pool"
    ospf: null, // { processId, routerId, networks: [{network, wildcard, area}], passiveInterfaces: Set, referenceBandwidth } — see "router ospf <id>"
    accessLists: {}, // key (number as string, or name) -> { type: "standard"|"extended", entries: [...] } — see "access-list"/"ip access-list extended"
    natStaticRules: [], // [{ localIp, globalIp }] — see "ip nat inside source static"
    natPools: {}, // name -> { start, end, netmask } — see "ip nat pool"
    natDynamicRules: [], // [{ aclNumber, poolName|null, interfaceName|null, overload }] — see "ip nat inside source list"
    cdpEnabled: true,   // real IOS default — set via "cdp run" / "no cdp run"
    lldpEnabled: false, // real IOS default — set via "lldp run"
    ntpMasterStratum: null, // set via "ntp master <stratum>"
    ntpServer: null,        // set via "ntp server <ip>"
    snmpCommunities: [],    // [{ string, access: "ro"|"rw" }] — see "snmp-server community"
    snmpLocation: null,     // set via "snmp-server location <text>"
    snmpContact: null,      // set via "snmp-server contact <text>"
    snmpHost: null,         // { ip, version, community } — see "snmp-server host"
    snmpTrapsEnabled: false, // set via "snmp-server enable traps"
    loggingHost: null,      // set via "logging host <ip>"
    loggingTrapLevel: null, // set via "logging trap <level>"
    loggingSourceInterface: null, // set via "logging source-interface <name>"
    serviceTimestampsLog: false,  // set via "service timestamps log datetime msec"
    enableSecret: null,
    enablePassword: null,
    servicePasswordEncryption: false,
    bannerMotd: null,
    ipDomainLookup: true,  // real IOS default is ON; "no ip domain-lookup" turns it off
    ipv6UnicastRouting: false, // real IOS default is OFF — must be explicitly enabled
    users: {},                 // named local user database: username -> { secret }
    domainName: null,          // set via "ip domain-name <name>", needed for RSA key naming
    securityPasswordsMinLength: null, // set via "security passwords min-length <n>"
    sshVersion: null,          // set via "ip ssh version <n>"
    sshTimeout: null,          // set via "ip ssh time-out <sec>"; real IOS default shown is 120 when unset
    sshAuthRetries: null,      // set via "ip ssh authentication-retries <n>"; real IOS default shown is 3 when unset
    loginBlockFor: null,       // set via "login block-for <sec> attempts <n> within <sec>"
    cryptoKeysGenerated: false, // set true by "crypto key generate rsa modulus <n>"
    startupConfig: null,   // null = "startup-config is not present" (never saved)
    pendingPrompt: null    // set when device is mid-interactive-prompt (copy/erase/reload)
  };
}

function getOrCreateInterface(device, name) {
  if (!device.interfaces[name]) {
    device.interfaces[name] = freshInterfaceState(defaultsUpAtCreation(device.deviceType, name));
  }
  return device.interfaces[name];
}

function getOrCreateLine(device, name) {
  if (!device.lines[name]) {
    device.lines[name] = { password: null, login: false };
  }
  return device.lines[name];
}

function setUser(device, username, secret, privilege) {
  device.users[username] = { secret: secret, privilege: privilege !== undefined ? privilege : null };
}

/* ---------------------------------------------------------
   2. PROMPT RENDERING
   --------------------------------------------------------- */

function getPrompt(device) {
  switch (device.mode) {
    case "user_exec": return device.hostname + ">";
    case "priv_exec": return device.hostname + "#";
    case "global_config": return device.hostname + "(config)#";
    case "interface_config": return device.hostname + "(config-if)#";
    case "line_config": return device.hostname + "(config-line)#";
    case "vlan_config": return device.hostname + "(config-vlan)#";
    case "dhcp_pool_config": return device.hostname + "(dhcp-config)#";
    // Real prompt verified against a real Packet Tracer capture
    // (v1.35.0): "(config-dhcpv6)#" — this project's own ground-truth
    // reference data had incorrectly shown "(config-dhcp)#" (the SAME
    // prompt as the IPv4 pool mode) for the IPv6 pool too; the real
    // capture confirms these are genuinely different prompts.
    case "ipv6_dhcp_pool_config": return device.hostname + "(config-dhcpv6)#";
    case "router_config": return device.hostname + "(config-router)#";
    case "ext_nacl_config": return device.hostname + "(config-ext-nacl)#";
    default: return device.hostname + ">";
  }
}

/* ---------------------------------------------------------
   3. VALIDATION HELPERS
   --------------------------------------------------------- */

function isValidIPv4(str) {
  const parts = str.split(".");
  if (parts.length !== 4) return false;
  return parts.every(function (p) {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

function isValidMask(str) { return isValidIPv4(str); }

/* ---------------------------------------------------------
   IPv6 VALIDATION
   ------------------------------------------------------------
   Validates against genuine IPv6 syntax (RFC 4291): full 8-group
   hex addresses, or "::"-compressed forms. Deliberately not a
   full validator (no embedded-IPv4 or zone-ID support) — scoped to
   what CCNA actually teaches.

   Note: a real router capture showed "200:db8:1:1::1/64" rejected
   by real IOS with a caret error. That address is, however,
   genuinely valid IPv6 syntax (confirmed independently) — it's
   likely just a typo for "2001:db8:1:1::1" that happened to still
   parse as *some* valid address with fewer leading digits, and real
   IOS's actual rejection reason isn't confirmed from a single
   example. Rather than guess at a stricter-than-standard rule we
   can't verify, this validator follows genuine IPv6 syntax rules.
   --------------------------------------------------------- */

function isValidIPv6Address(str) {
  // Reject anything with characters outside hex digits, colons.
  if (!/^[0-9A-Fa-f:]+$/.test(str)) return false;
  // At most one "::" compression marker.
  const doubleColonCount = (str.match(/::/g) || []).length;
  if (doubleColonCount > 1) return false;

  if (doubleColonCount === 1) {
    const parts = str.split("::");
    if (parts.length !== 2) return false;
    const left = parts[0].length ? parts[0].split(":") : [];
    const right = parts[1].length ? parts[1].split(":") : [];
    const totalGroups = left.length + right.length;
    if (totalGroups >= 8) return false; // "::" must represent at least one group
    return left.concat(right).every(function (g) { return /^[0-9A-Fa-f]{1,4}$/.test(g); });
  }

  // No compression — must be exactly 8 groups.
  const groups = str.split(":");
  if (groups.length !== 8) return false;
  return groups.every(function (g) { return /^[0-9A-Fa-f]{1,4}$/.test(g); });
}

// Parses "2001:db8:acad:1::1/64" into { address, prefixLength }, or
// null if the /prefix portion is missing or malformed.
function parseIPv6WithPrefix(str) {
  const m = str.match(/^([^/]+)\/(\d{1,3})$/);
  if (!m) return null;
  const prefixLength = Number(m[2]);
  if (prefixLength < 0 || prefixLength > 128) return null;
  return { address: m[1], prefixLength: prefixLength };
}

// Real IOS displays IPv6 addresses in uppercase hex — verified
// against a real capture ("FE80::1", "2001:DB8:1:1::1").
function formatIPv6Display(addr) {
  return addr.toUpperCase();
}

/* ---------------------------------------------------------
   INTERFACE NAME NORMALIZATION
   ------------------------------------------------------------
   Real IOS accepts abbreviated interface type names (g0/0, gi0/0,
   fa0/1, se0/0/0, ...) and resolves them to the canonical full type
   name (GigabitEthernet0/0, FastEthernet0/1, Serial0/0/0, ...) —
   the numbering/slot portion after the type name is kept exactly
   as typed, never altered. Without this, "g0/0" and
   "GigabitEthernet0/0" would be treated as two unrelated interfaces,
   which is a real bug found during testing (v1.35.0).

   Matching uses the same "shortest unambiguous prefix" principle as
   command-keyword abbreviation, applied here specifically to the
   TYPE portion of an interface name (the letters before the first
   digit) rather than the whole token.
   --------------------------------------------------------- */

const INTERFACE_TYPES = [
  "GigabitEthernet",
  "FastEthernet",
  "Serial",
  "Loopback",
  "Vlan"
];

// Splits "g0/0" into { typePart: "g", numberPart: "0/0" } by finding
// where letters end and the numbering begins.
function splitInterfaceName(raw) {
  const m = raw.match(/^([A-Za-z]+)(.*)$/);
  if (!m) return null;
  return { typePart: m[1], numberPart: m[2] };
}

// Returns the canonical full interface name, or the original input
// unchanged if it doesn't look like a recognizable abbreviation (so
// unknown/future interface types still work as free-form names
// rather than being rejected outright).
function normalizeInterfaceName(raw) {
  const split = splitInterfaceName(raw);
  if (!split) return raw;

  const candidates = INTERFACE_TYPES.filter(function (t) {
    return t.toLowerCase().startsWith(split.typePart.toLowerCase());
  });

  if (candidates.length === 1) {
    return candidates[0] + split.numberPart;
  }
  if (candidates.length > 1) {
    // Ambiguous abbreviation among known types (shouldn't normally
    // happen with typical short forms like "g"/"fa"/"se", but if it
    // does, prefer an EXACT case-insensitive full-name match if one
    // of the candidates equals what was typed; otherwise leave
    // unresolved rather than guess.
    const exact = candidates.find(function (t) {
      return t.toLowerCase() === split.typePart.toLowerCase();
    });
    if (exact) return exact + split.numberPart;
    return raw;
  }
  // No known type matched (e.g. already fully spelled correctly, or
  // a genuinely unrecognized type) — check for an exact case-
  // insensitive match against a known type before giving up.
  const exact = INTERFACE_TYPES.find(function (t) {
    return t.toLowerCase() === split.typePart.toLowerCase();
  });
  if (exact) return exact + split.numberPart;
  return raw;
}

// Converts a dotted-decimal IPv4 string to a 32-bit integer for
// subnet math. Assumes the string has already passed isValidIPv4.
function ipToInt(ip) {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// True if two IPv4 addresses are in the same subnet given a mask.
function sameSubnet(ipA, ipB, mask) {
  const maskInt = ipToInt(mask);
  return (ipToInt(ipA) & maskInt) === (ipToInt(ipB) & maskInt);
}

// Converts a 32-bit integer back to dotted-decimal notation.
function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

// Converts a dotted-decimal subnet mask to its CIDR prefix length
// (e.g. "255.255.255.224" -> 27). Assumes a valid, contiguous mask.
function maskToPrefixLength(mask) {
  const maskInt = ipToInt(mask);
  let count = 0;
  for (let bit = 31; bit >= 0; bit--) {
    if ((maskInt >>> bit) & 1) count++;
    else break;
  }
  return count;
}

// Computes the network address for an IP/mask pair (the IP with all
// host bits zeroed).
function networkAddress(ip, mask) {
  return intToIp(ipToInt(ip) & ipToInt(mask));
}

/* ---------------------------------------------------------
   4. COMMAND TABLE
   --------------------------------------------------------- */

const COMMANDS = [
  {
    id: "enable", modes: ["user_exec"], tokens: ["enable"],
    help: "enable", description: "Enter privileged EXEC mode.",
    handler: function (device) { device.mode = "priv_exec"; return { text: null, error: null }; }
  },
  {
    id: "disable", modes: ["priv_exec"], tokens: ["disable"],
    help: "disable", description: "Return to user EXEC mode.",
    handler: function (device) { device.mode = "user_exec"; return { text: null, error: null }; }
  },
  {
    id: "configure_terminal", modes: ["priv_exec"], tokens: ["configure", "terminal"],
    help: "configure terminal", description: "Enter global configuration mode.",
    handler: function (device) { device.mode = "global_config"; return { text: null, error: null }; }
  },
  {
    id: "hostname", modes: ["global_config"], tokens: ["hostname", "<name>"],
    help: "hostname <name>", description: "Set the device hostname.",
    handler: function (device, args) { device.hostname = args[0]; return { text: null, error: null }; }
  },
  {
    id: "interface", modes: ["global_config", "interface_config"], tokens: ["interface", "<name>"],
    help: "interface <full-interface-name>  (e.g. GigabitEthernet0/0)",
    description: "Enter interface configuration mode for the named interface.",
    handler: function (device, args) {
      const name = normalizeInterfaceName(args[0]);
      getOrCreateInterface(device, name);
      device.currentInterface = name;
      device.mode = "interface_config";
      return { text: null, error: null };
    }
  },
  {
    id: "interface_vlan", modes: ["global_config", "interface_config"], tokens: ["interface", "vlan", "<id>"],
    help: "interface vlan <id>",
    description: "Enter interface configuration mode for a VLAN's switch virtual interface (SVI) — only works if that VLAN already exists.",
    handler: function (device, args) {
      const id = Number(args[0]);
      // Real IOS rejects "interface vlan <id>" with "% Invalid input
      // detected" if that VLAN hasn't been created yet via "vlan
      // <id>" first — verified against a real Packet Tracer capture
      // (v1.35.0), and confirmed as genuine, reproducible IOS
      // behavior (not a simulator quirk) via multiple independent
      // real-hardware reports. VLAN 1 always exists by default (see
      // freshVlanTable()), which is why "interface vlan 1" has always
      // correctly worked in every exercise that's used it since
      // Course 1.
      if (!device.vlans[id]) {
        return { text: null, error: "% Invalid input detected" };
      }
      const name = "Vlan" + id;
      getOrCreateInterface(device, name);
      device.currentInterface = name;
      device.mode = "interface_config";
      return { text: null, error: null };
    }
  },
  {
    id: "ip_address", modes: ["interface_config"], tokens: ["ip", "address", "<ip>", "<mask>"],
    help: "ip address <ip-address> <subnet-mask>",
    description: "Assign an IPv4 address and mask to the current interface.",
    handler: function (device, args) {
      const ip = args[0], mask = args[1];
      if (!isValidIPv4(ip)) return { text: null, error: "% Invalid IP address: " + ip };
      if (!isValidMask(mask)) return { text: null, error: "% Invalid subnet mask: " + mask };
      const iface = getOrCreateInterface(device, device.currentInterface);
      iface.ip = ip; iface.mask = mask;
      return { text: null, error: null };
    }
  },
  {
    id: "ip_helper_address", modes: ["interface_config"], tokens: ["ip", "helper-address", "<ip>"],
    help: "ip helper-address <ip-address>",
    description: "Relay DHCP (and other UDP broadcast) client requests on this interface to a server on another subnet.",
    handler: function (device, args) {
      if (!isValidIPv4(args[0])) return { text: null, error: "% Invalid input detected" };
      getOrCreateInterface(device, device.currentInterface).helperAddress = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "show_ip_interface_detail", modes: ["priv_exec"], tokens: ["show", "ip", "interface", "<name>"],
    help: "show ip interface <interface-name>",
    description: "Display detailed IP-layer status and settings for one interface (a longer, IP-specific report than \"show ip interface brief\").",
    handler: function (device, args) {
      const name = normalizeInterfaceName(args[0]);
      if (!device.interfaces[name]) {
        return { text: null, error: "% Invalid interface" };
      }
      return { text: renderShowIpInterfaceDetail(device, name), error: null };
    }
  },
  {
    id: "shutdown", modes: ["interface_config"], tokens: ["shutdown"],
    help: "shutdown", description: "Administratively disable the current interface.",
    handler: function (device) {
      getOrCreateInterface(device, device.currentInterface).shutdown = true;
      return { text: null, error: null };
    }
  },
  {
    id: "no_shutdown", modes: ["interface_config"], tokens: ["no", "shutdown"],
    help: "no shutdown", description: "Administratively enable the current interface.",
    handler: function (device) {
      getOrCreateInterface(device, device.currentInterface).shutdown = false;
      const name = device.currentInterface;
      // Real IOS distinguishes SVIs (Vlan1, etc. — no physical link,
      // only ever administratively up/down) from physical interfaces
      // (which also negotiate a line protocol state). Verified against
      // a real router capture: a physical interface produces BOTH
      // %LINK-5-CHANGED and %LINEPROTO-5-UPDOWN as two separate lines;
      // our earlier switch captures only ever showed %LINK-5-CHANGED
      // for Vlan1.
      const isPhysical = !/^Vlan/i.test(name);
      let text = "%LINK-5-CHANGED: Interface " + name + ", changed state to up";
      if (isPhysical) {
        text += "\n%LINEPROTO-5-UPDOWN: Line protocol on Interface " + name + ", changed state to up";
      }
      // Router-on-a-stick cascading behavior — verified EXACTLY
      // against a real router capture (v1.35.0): "no shutdown" on a
      // PHYSICAL interface also brings up every existing subinterface
      // under it (subinterfaces have no independent admin-up/down
      // state of their own — only the parent physical port does).
      // The real message shape per subinterface is genuinely odd and
      // would have been impossible to guess correctly without the
      // capture: "%LINK-3-UPDOWN: ... changed state to DOWN"
      // immediately followed by "%LINEPROTO-5-UPDOWN: ... changed
      // state to UP" — the link message reports "down" while the very
      // next line reports the line protocol as "up". Only applies
      // when bringing up a PHYSICAL interface that is not itself a
      // subinterface (subinterfaces already only ever go through
      // encapsulation/ip address — see the "no subinterface shutdown
      // line at all" note in renderConfigText).
      if (isPhysical && !isSubinterfaceName(name)) {
        const subNames = Object.keys(device.interfaces).filter(function (n) {
          return n !== name && parentInterfaceName(n) === name && isSubinterfaceName(n);
        });
        for (let i = 0; i < subNames.length; i++) {
          const subIface = getOrCreateInterface(device, subNames[i]);
          subIface.shutdown = false;
          text += "\n%LINK-3-UPDOWN: Interface " + subNames[i] + ", changed state to down";
          text += "\n%LINEPROTO-5-UPDOWN: Line protocol on Interface " + subNames[i] + ", changed state to up";
        }
      }
      return { text: text, error: null };
    }
  },
  {
    id: "description", modes: ["interface_config"], tokens: ["description", "<text>"],
    help: "description <text>",
    description: "Add a text description to document the purpose of the current interface.",
    handler: function (device, args) {
      getOrCreateInterface(device, device.currentInterface).description = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "line_console", modes: ["global_config", "interface_config"], tokens: ["line", "console", "0"],
    help: "line console 0", description: "Enter line configuration mode for the console port.",
    handler: function (device) {
      const name = "console 0";
      getOrCreateLine(device, name);
      device.currentLine = name;
      device.currentInterface = null;
      device.mode = "line_config";
      return { text: null, error: null };
    }
  },
  {
    id: "line_vty", modes: ["global_config", "interface_config"], tokens: ["line", "vty", "0", "15"],
    help: "line vty 0 15",
    description: "Enter line configuration mode for VTY lines 0-15 (switch convention, 16 lines).",
    handler: function (device) {
      const name = "vty 0 15";
      getOrCreateLine(device, name);
      device.currentLine = name;
      device.currentInterface = null;
      device.mode = "line_config";
      return { text: null, error: null };
    }
  },
  {
    id: "line_vty_router", modes: ["global_config", "interface_config"], tokens: ["line", "vty", "0", "4"],
    help: "line vty 0 4",
    description: "Enter line configuration mode for VTY lines 0-4 (router convention, 5 lines).",
    handler: function (device) {
      const name = "vty 0 4";
      getOrCreateLine(device, name);
      device.currentLine = name;
      device.currentInterface = null;
      device.mode = "line_config";
      return { text: null, error: null };
    }
  },
  {
    id: "line_password", modes: ["line_config"], tokens: ["password", "<password>"],
    help: "password <password>", description: "Set the password required to access this line.",
    handler: function (device, args) {
      getOrCreateLine(device, device.currentLine).password = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "line_login", modes: ["line_config"], tokens: ["login"],
    help: "login", description: "Enable password checking at login for this line.",
    handler: function (device) {
      getOrCreateLine(device, device.currentLine).login = true;
      return { text: null, error: null };
    }
  },
  {
    id: "line_logging_synchronous", modes: ["line_config"], tokens: ["logging", "synchronous"],
    help: "logging synchronous",
    description: "Prevent unsolicited log/debug messages from interrupting command entry on this line.",
    handler: function (device) {
      getOrCreateLine(device, device.currentLine).loggingSynchronous = true;
      return { text: null, error: null };
    }
  },
  {
    id: "line_exec_timeout", modes: ["line_config"], tokens: ["exec-timeout", "<minutes>", "<seconds>"],
    help: "exec-timeout <minutes> <seconds>",
    description: "Set the idle timeout before this line disconnects (0 0 means never).",
    handler: function (device, args) {
      const line = getOrCreateLine(device, device.currentLine);
      line.execTimeoutMinutes = args[0];
      line.execTimeoutSeconds = args[1];
      return { text: null, error: null };
    }
  },
  {
    id: "no_ip_domain_lookup", modes: ["global_config"], tokens: ["no", "ip", "domain-lookup"],
    help: "no ip domain-lookup",
    description: "Disable DNS lookups, preventing long delays when a mistyped command is interpreted as a hostname.",
    handler: function (device) {
      device.ipDomainLookup = false;
      return { text: null, error: null };
    }
  },
  {
    id: "ipv6_unicast_routing", modes: ["global_config"], tokens: ["ipv6", "unicast-routing"],
    help: "ipv6 unicast-routing",
    description: "Enable IPv6 routing globally on the device (off by default).",
    handler: function (device) {
      device.ipv6UnicastRouting = true;
      return { text: null, error: null };
    }
  },
  {
    id: "security_passwords_min_length", modes: ["global_config"],
    tokens: ["security", "passwords", "min-length", "<n>"],
    help: "security passwords min-length <n>",
    description: "Set the minimum length required for newly configured passwords.",
    handler: function (device, args) {
      device.securityPasswordsMinLength = Number(args[0]);
      return { text: null, error: null };
    }
  },
  {
    id: "login_block_for", modes: ["global_config"],
    tokens: ["login", "block-for", "<sec>", "attempts", "<n>", "within", "<within>"],
    help: "login block-for <seconds> attempts <n> within <seconds>",
    description: "Block further login attempts for a period after too many failures within a time window — brute-force login protection.",
    handler: function (device, args) {
      device.loginBlockFor = { seconds: Number(args[0]), attempts: Number(args[1]), within: Number(args[2]) };
      return { text: null, error: null };
    }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: ip route"), since the trailing admin
    // distance argument is OPTIONAL and the fixed-token matcher can't
    // express that. This entry exists purely so the command shows up
    // correctly in ?commands help and Tab completion, matching the
    // same pattern used for "description" and "banner motd".
    id: "ip_route", modes: ["global_config"],
    tokens: ["ip", "route", "<network>", "<mask>", "<next-hop>"],
    help: "ip route <network> <mask> <next-hop> [admin-distance]",
    description: "Add a static route. Optional trailing admin-distance (default 1) creates a floating static route, only used if a lower-AD route to the same destination is unavailable.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: no ip route").
    id: "no_ip_route", modes: ["global_config"],
    tokens: ["no", "ip", "route", "<network>", "<mask>", "<next-hop>"],
    help: "no ip route <network> <mask> <next-hop> [admin-distance]",
    description: "Remove a previously configured static route.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    id: "ip_dhcp_excluded_address", modes: ["global_config"],
    tokens: ["ip", "dhcp", "excluded-address", "<start>", "<end>"],
    help: "ip dhcp excluded-address <start-ip> <end-ip>",
    description: "Reserve a range of addresses so DHCP never assigns them (e.g. addresses already used by servers/routers).",
    handler: function (device, args) {
      if (!isValidIPv4(args[0]) || !isValidIPv4(args[1])) {
        return { text: null, error: "% Invalid input detected" };
      }
      device.dhcpExcludedRanges.push({ start: args[0], end: args[1] });
      return { text: null, error: null };
    }
  },
  {
    id: "ip_dhcp_pool", modes: ["global_config"],
    tokens: ["ip", "dhcp", "pool", "<name>"],
    help: "ip dhcp pool <name>",
    description: "Create (or enter configuration mode for) a named DHCP address pool.",
    handler: function (device, args) {
      const name = args[0];
      if (!device.dhcpPools[name]) {
        device.dhcpPools[name] = { network: null, mask: null, defaultRouter: null, dnsServer: null, domainName: null };
      }
      device.currentDhcpPool = name;
      device.mode = "dhcp_pool_config";
      return { text: null, error: null };
    }
  },
  {
    id: "dhcp_network", modes: ["dhcp_pool_config"], tokens: ["network", "<network>", "<mask>"],
    help: "network <network> <mask>",
    description: "Define the range of addresses this pool will hand out.",
    handler: function (device, args) {
      const pool = device.dhcpPools[device.currentDhcpPool];
      pool.network = args[0];
      pool.mask = args[1];
      return { text: null, error: null };
    }
  },
  {
    id: "dhcp_default_router", modes: ["dhcp_pool_config"], tokens: ["default-router", "<ip>"],
    help: "default-router <ip-address>",
    description: "Set the default gateway address handed out to DHCP clients in this pool.",
    handler: function (device, args) {
      device.dhcpPools[device.currentDhcpPool].defaultRouter = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "dhcp_dns_server", modes: ["dhcp_pool_config"], tokens: ["dns-server", "<ip>"],
    help: "dns-server <ip-address>",
    description: "Set the DNS server address handed out to DHCP clients in this pool.",
    handler: function (device, args) {
      device.dhcpPools[device.currentDhcpPool].dnsServer = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "dhcp_domain_name", modes: ["dhcp_pool_config"], tokens: ["domain-name", "<name>"],
    help: "domain-name <name>",
    description: "Set the domain name handed out to DHCP clients in this pool.",
    handler: function (device, args) {
      device.dhcpPools[device.currentDhcpPool].domainName = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "show_ip_dhcp_pool", modes: ["priv_exec"], tokens: ["show", "ip", "dhcp", "pool"],
    help: "show ip dhcp pool",
    description: "Display configured DHCP pools, their address ranges, and utilization.",
    handler: function (device) { return { text: renderShowIpDhcpPool(device), error: null }; }
  },
  {
    id: "ipv6_dhcp_pool", modes: ["global_config"], tokens: ["ipv6", "dhcp", "pool", "<name>"],
    help: "ipv6 dhcp pool <name>",
    description: "Create (or enter configuration mode for) a named DHCPv6 pool.",
    handler: function (device, args) {
      const name = args[0];
      if (!device.ipv6DhcpPools[name]) {
        device.ipv6DhcpPools[name] = { addressPrefix: null, dnsServer: null, domainName: null };
      }
      device.currentIpv6DhcpPool = name;
      device.mode = "ipv6_dhcp_pool_config";
      return { text: null, error: null };
    }
  },
  {
    id: "ipv6_dhcp_address_prefix", modes: ["ipv6_dhcp_pool_config"],
    tokens: ["address", "prefix", "<prefix>"],
    help: "address prefix <ipv6-prefix>/<length>",
    description: "Define the IPv6 address range this pool assigns from (stateful DHCPv6 only).",
    handler: function (device, args) {
      device.ipv6DhcpPools[device.currentIpv6DhcpPool].addressPrefix = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "ipv6_dhcp_dns_server", modes: ["ipv6_dhcp_pool_config"], tokens: ["dns-server", "<ipv6>"],
    help: "dns-server <ipv6-address>",
    description: "Set the DNS server address handed out to DHCPv6 clients in this pool.",
    handler: function (device, args) {
      device.ipv6DhcpPools[device.currentIpv6DhcpPool].dnsServer = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "ipv6_dhcp_domain_name", modes: ["ipv6_dhcp_pool_config"], tokens: ["domain-name", "<name>"],
    help: "domain-name <name>",
    description: "Set the domain name handed out to DHCPv6 clients in this pool.",
    handler: function (device, args) {
      device.ipv6DhcpPools[device.currentIpv6DhcpPool].domainName = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "ipv6_nd_other_config_flag", modes: ["interface_config"], tokens: ["ipv6", "nd", "other-config-flag"],
    help: "ipv6 nd other-config-flag",
    description: "Set the O-flag in router advertisements — tells hosts to use SLAAC for their address, but ask DHCPv6 for DNS/domain info only (stateless DHCPv6).",
    handler: function (device) {
      getOrCreateInterface(device, device.currentInterface).ipv6OtherConfigFlag = true;
      return { text: null, error: null };
    }
  },
  {
    id: "ipv6_nd_managed_config_flag", modes: ["interface_config"], tokens: ["ipv6", "nd", "managed-config-flag"],
    help: "ipv6 nd managed-config-flag",
    description: "Set the M-flag in router advertisements — tells hosts to get their full IPv6 address (and DNS/domain info) from DHCPv6 (stateful DHCPv6).",
    handler: function (device) {
      getOrCreateInterface(device, device.currentInterface).ipv6ManagedConfigFlag = true;
      return { text: null, error: null };
    }
  },
  {
    id: "ipv6_dhcp_server", modes: ["interface_config"], tokens: ["ipv6", "dhcp", "server", "<pool-name>"],
    help: "ipv6 dhcp server <pool-name>",
    description: "Bind a DHCPv6 pool to this interface, so it answers DHCPv6 requests from clients on this link.",
    handler: function (device, args) {
      getOrCreateInterface(device, device.currentInterface).ipv6DhcpServerPool = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "router_ospf", modes: ["global_config"], tokens: ["router", "ospf", "<process-id>"],
    help: "router ospf <process-id>",
    description: "Start (or re-enter configuration mode for) an OSPFv2 routing process.",
    handler: function (device, args) {
      if (!device.ospf) {
        device.ospf = {
          processId: Number(args[0]), routerId: null,
          networks: [], passiveInterfaces: [], referenceBandwidth: 100
        };
      }
      device.mode = "router_config";
      return { text: null, error: null };
    }
  },
  {
    id: "ospf_router_id", modes: ["router_config"], tokens: ["router-id", "<id>"],
    help: "router-id <a.b.c.d>",
    description: "Explicitly set this router's OSPF router ID (otherwise IOS picks one automatically from configured interfaces).",
    handler: function (device, args) {
      device.ospf.routerId = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "ospf_network", modes: ["router_config"], tokens: ["network", "<network>", "<wildcard>", "area", "<area>"],
    help: "network <network> <wildcard-mask> area <area-id>",
    description: "Enable OSPF on any interface whose IP falls within this network/wildcard range, and advertise it in the given area.",
    handler: function (device, args) {
      if (!isValidIPv4(args[0]) || !isValidIPv4(args[1])) {
        return { text: null, error: "% Invalid input detected" };
      }
      device.ospf.networks.push({ network: args[0], wildcard: args[1], area: args[2] });
      return { text: null, error: null };
    }
  },
  {
    id: "ospf_passive_interface", modes: ["router_config"], tokens: ["passive-interface", "<name>"],
    help: "passive-interface <interface-name>",
    description: "Stop sending OSPF hellos out this interface, while still advertising its network — used for LAN interfaces with no OSPF neighbors expected.",
    handler: function (device, args) {
      const name = normalizeInterfaceName(args[0]);
      if (device.ospf.passiveInterfaces.indexOf(name) === -1) {
        device.ospf.passiveInterfaces.push(name);
      }
      return { text: null, error: null };
    }
  },
  {
    id: "ospf_auto_cost", modes: ["router_config"], tokens: ["auto-cost", "reference-bandwidth", "<mbps>"],
    help: "auto-cost reference-bandwidth <mbps>",
    description: "Change the reference bandwidth used to calculate OSPF interface cost (default 100 Mbps) — needed on modern networks where many links are faster than the old default.",
    handler: function (device, args) {
      device.ospf.referenceBandwidth = Number(args[0]);
      return { text: null, error: null };
    }
  },
  {
    id: "ip_ospf_priority", modes: ["interface_config"], tokens: ["ip", "ospf", "priority", "<n>"],
    help: "ip ospf priority <n>",
    description: "Set this interface's priority in DR/BDR election — higher wins; 0 means this interface can never become DR or BDR.",
    handler: function (device, args) {
      getOrCreateInterface(device, device.currentInterface).ospfPriority = Number(args[0]);
      return { text: null, error: null };
    }
  },
  {
    id: "ip_ospf_hello_interval", modes: ["interface_config"], tokens: ["ip", "ospf", "hello-interval", "<sec>"],
    help: "ip ospf hello-interval <seconds>",
    description: "Set how often OSPF hello packets are sent on this interface (default 10 seconds on most media) — must match on both ends of a link.",
    handler: function (device, args) {
      getOrCreateInterface(device, device.currentInterface).ospfHelloInterval = Number(args[0]);
      return { text: null, error: null };
    }
  },
  {
    id: "ip_ospf_dead_interval", modes: ["interface_config"], tokens: ["ip", "ospf", "dead-interval", "<sec>"],
    help: "ip ospf dead-interval <seconds>",
    description: "Set how long to wait without hearing a hello before declaring a neighbor down (default 40 seconds on most media) — must match on both ends of a link.",
    handler: function (device, args) {
      getOrCreateInterface(device, device.currentInterface).ospfDeadInterval = Number(args[0]);
      return { text: null, error: null };
    }
  },
  {
    id: "ip_ospf_message_digest_key", modes: ["interface_config"],
    tokens: ["ip", "ospf", "message-digest-key", "<id>", "md5", "<key>"],
    help: "ip ospf message-digest-key <key-id> md5 <key>",
    description: "Configure the MD5 key used to authenticate OSPF packets on this interface — must match on both ends of a link.",
    handler: function (device, args) {
      const iface = getOrCreateInterface(device, device.currentInterface);
      iface.ospfMd5KeyId = Number(args[0]);
      iface.ospfMd5Key = args[1];
      return { text: null, error: null };
    }
  },
  {
    id: "ip_ospf_authentication_md5", modes: ["interface_config"],
    tokens: ["ip", "ospf", "authentication", "message-digest"],
    help: "ip ospf authentication message-digest",
    description: "Require MD5-authenticated OSPF packets on this interface (used with ip ospf message-digest-key).",
    handler: function (device) {
      getOrCreateInterface(device, device.currentInterface).ospfMd5AuthEnabled = true;
      return { text: null, error: null };
    }
  },
  {
    id: "show_ip_ospf_neighbor", modes: ["priv_exec"], tokens: ["show", "ip", "ospf", "neighbor"],
    help: "show ip ospf neighbor",
    description: "Display OSPF neighbor adjacencies — verify OSPF has formed relationships with directly connected routers.",
    handler: function (device) { return { text: renderShowIpOspfNeighbor(device), error: null }; }
  },
  {
    id: "show_ip_protocol", modes: ["priv_exec"], tokens: ["show", "ip", "protocol"],
    help: "show ip protocol",
    description: "Display the configured routing protocol(s), including router ID, areas, and advertised networks.",
    handler: function (device) { return { text: renderShowIpProtocol(device), error: null }; }
  },
  {
    id: "show_ip_ospf_interface", modes: ["priv_exec"], tokens: ["show", "ip", "ospf", "interface", "<name>"],
    help: "show ip ospf interface <interface-name>",
    description: "Display detailed OSPF status for one interface — area, cost, priority, DR/BDR, and timers.",
    handler: function (device, args) {
      const name = normalizeInterfaceName(args[0]);
      if (!device.interfaces[name]) {
        return { text: null, error: "% Invalid interface" };
      }
      return { text: renderShowIpOspfInterface(device, name), error: null };
    }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: encapsulation dot1Q").
    id: "encapsulation_dot1q", modes: ["interface_config"],
    tokens: ["encapsulation", "dot1Q", "<vlan-id>"],
    help: "encapsulation dot1Q <vlan-id> [native]",
    description: "Set 802.1Q trunk encapsulation on a subinterface, tagging its traffic for a specific VLAN. Only valid on a subinterface (interface name containing a dot, e.g. GigabitEthernet0/0.10).",
    handler: function () { return { text: null, error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: access-list ... permit|deny").
    id: "access_list_standard", modes: ["global_config"],
    tokens: ["access-list", "<n>", "permit|deny", "host|network", "<wildcard>"],
    help: "access-list <1-99> permit|deny host <ip>  OR  access-list <1-99> permit|deny <network> <wildcard>",
    description: "Add an entry to a numbered standard ACL, matching on source address only. Entries are numbered automatically (10, 20, 30...) in the order they're added.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: ip access-group").
    id: "ip_access_group", modes: ["interface_config"],
    tokens: ["ip", "access-group", "<n-or-name>", "in|out"],
    help: "ip access-group <number-or-name> in|out",
    description: "Apply an ACL to this interface in a given direction — traffic is filtered as it enters (in) or leaves (out).",
    handler: function () { return { text: null, error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: ip access-list extended").
    id: "ip_access_list_extended", modes: ["global_config"],
    tokens: ["ip", "access-list", "extended", "<name>"],
    help: "ip access-list extended <name>",
    description: "Create (or enter configuration mode for) a named extended ACL, which can filter on protocol, source, destination, and port.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: extended ACL entries"). This shadow entry's
    // tokens are necessarily approximate, since real entries have
    // variable length depending on the address forms used — exists
    // mainly so "?commands" shows something reasonable for this mode.
    id: "acl_extended_entry", modes: ["ext_nacl_config"],
    tokens: ["permit|deny", "tcp|udp", "<src>", "<dst>", "eq|established"],
    help: "permit|deny tcp|udp <src> [wildcard] <dst> [wildcard] [eq <port> | established]",
    description: "Add an entry to this extended ACL. Source/destination can each be \"any\", \"host <ip>\", or \"<network> <wildcard>\". \"eq <port>\" matches a specific port; \"established\" matches return traffic for connections initiated elsewhere.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    id: "show_access_lists", modes: ["priv_exec"], tokens: ["show", "access-lists"],
    help: "show access-lists",
    description: "Display all configured ACLs, their entries, and auto-assigned sequence numbers.",
    handler: function (device) { return { text: renderShowAccessLists(device), error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: ip nat inside/outside").
    id: "ip_nat_role", modes: ["interface_config"],
    tokens: ["ip", "nat", "inside|outside"],
    help: "ip nat inside | ip nat outside",
    description: "Mark this interface as facing the inside (private) or outside (public) network — NAT only translates traffic crossing between an inside and an outside interface.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: ip nat inside source static").
    id: "ip_nat_static", modes: ["global_config"],
    tokens: ["ip", "nat", "inside", "source", "static", "<local>", "<global>"],
    help: "ip nat inside source static <local-ip> <global-ip>",
    description: "Create a permanent one-to-one mapping between an inside private address and an outside public address — used for servers that need a fixed public IP.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: ip nat pool").
    id: "ip_nat_pool", modes: ["global_config"],
    tokens: ["ip", "nat", "pool", "<name>", "<start>", "<end>", "netmask", "<mask>"],
    help: "ip nat pool <name> <start-ip> <end-ip> netmask <mask>",
    description: "Define a pool of public addresses for dynamic NAT or PAT to assign from.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: ip nat inside source list").
    id: "ip_nat_dynamic", modes: ["global_config"],
    tokens: ["ip", "nat", "inside", "source", "list", "<acl>", "pool|interface", "<name>"],
    help: "ip nat inside source list <acl> pool <name> [overload]  OR  ip nat inside source list <acl> interface <name> overload",
    description: "Translate inside addresses matching an ACL using a pool (Dynamic NAT), or with \"overload\" using either a pool or a single interface's address (PAT) — overload lets many inside hosts share fewer outside addresses via port numbers.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    id: "show_ip_nat_translations", modes: ["priv_exec"], tokens: ["show", "ip", "nat", "translations"],
    help: "show ip nat translations",
    description: "Display active NAT translation entries — which inside addresses are currently mapped to which outside addresses.",
    handler: function (device) { return { text: renderShowIpNatTranslations(device), error: null }; }
  },
  {
    id: "show_ip_nat_statistics", modes: ["priv_exec"], tokens: ["show", "ip", "nat", "statistics"],
    help: "show ip nat statistics",
    description: "Display NAT configuration summary — inside/outside interfaces, pool usage, and hit/miss counts.",
    handler: function (device) { return { text: renderShowIpNatStatistics(device), error: null }; }
  },
  {
    id: "cdp_run", modes: ["global_config"], tokens: ["cdp", "run"],
    help: "cdp run",
    description: "Enable CDP globally. Real IOS has this ON by default — this command exists mainly to re-enable it after \"no cdp run\".",
    handler: function (device) { device.cdpEnabled = true; return { text: null, error: null }; }
  },
  {
    id: "no_cdp_run", modes: ["global_config"], tokens: ["no", "cdp", "run"],
    help: "no cdp run",
    description: "Disable CDP globally — stops advertising to and learning about ALL neighbors, Cisco or otherwise.",
    handler: function (device) { device.cdpEnabled = false; return { text: null, error: null }; }
  },
  {
    id: "lldp_run", modes: ["global_config"], tokens: ["lldp", "run"],
    help: "lldp run",
    description: "Enable LLDP globally. Real IOS has this OFF by default — must be explicitly enabled, unlike CDP.",
    handler: function (device) { device.lldpEnabled = true; return { text: null, error: null }; }
  },
  {
    id: "lldp_transmit", modes: ["interface_config"], tokens: ["lldp", "transmit"],
    help: "lldp transmit",
    description: "Allow this interface to SEND LLDP advertisements to its neighbor.",
    handler: function (device) { getOrCreateInterface(device, device.currentInterface).lldpTransmit = true; return { text: null, error: null }; }
  },
  {
    id: "lldp_receive", modes: ["interface_config"], tokens: ["lldp", "receive"],
    help: "lldp receive",
    description: "Allow this interface to PROCESS LLDP advertisements received from its neighbor.",
    handler: function (device) { getOrCreateInterface(device, device.currentInterface).lldpReceive = true; return { text: null, error: null }; }
  },
  {
    id: "show_cdp_neighbors", modes: ["priv_exec"], tokens: ["show", "cdp", "neighbors"],
    help: "show cdp neighbors",
    description: "Display directly-connected Cisco devices discovered via CDP.",
    handler: function (device) { return { text: renderShowCdpNeighbors(device), error: null }; }
  },
  {
    id: "show_lldp_neighbors", modes: ["priv_exec"], tokens: ["show", "lldp", "neighbors"],
    help: "show lldp neighbors",
    description: "Display directly-connected devices discovered via LLDP — may include non-Cisco equipment.",
    handler: function (device) { return { text: renderShowLldpNeighbors(device), error: null }; }
  },
  {
    id: "ntp_master", modes: ["global_config"], tokens: ["ntp", "master", "<stratum>"],
    help: "ntp master <stratum>",
    description: "Make this device an authoritative NTP time source at the given stratum (1 = highest accuracy, typically an atomic/GPS clock; higher numbers are further from the original source).",
    handler: function (device, args) { device.ntpMasterStratum = Number(args[0]); return { text: null, error: null }; }
  },
  {
    id: "ntp_server", modes: ["global_config"], tokens: ["ntp", "server", "<ip>"],
    help: "ntp server <ip-address>",
    description: "Synchronize this device's clock from another device acting as an NTP server.",
    handler: function (device, args) {
      if (!isValidIPv4(args[0])) return { text: null, error: "% Invalid input detected" };
      device.ntpServer = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "show_ntp_status", modes: ["priv_exec"], tokens: ["show", "ntp", "status"],
    help: "show ntp status",
    description: "Display this device's own NTP synchronization state — stratum, reference, and clock precision.",
    handler: function (device) { return { text: renderShowNtpStatus(device), error: null }; }
  },
  {
    id: "show_ntp_associations", modes: ["priv_exec"], tokens: ["show", "ntp", "associations"],
    help: "show ntp associations",
    description: "Display NTP peers this device is tracking, including which one it's actually synced to.",
    handler: function (device) { return { text: renderShowNtpAssociations(device), error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: snmp-server community").
    id: "snmp_server_community", modes: ["global_config"],
    tokens: ["snmp-server", "community", "<string>", "ro|rw"],
    help: "snmp-server community <string> ro|rw",
    description: "Set an SNMP community string (acts like a password) with read-only (ro) or read-write (rw) access.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: snmp-server location").
    id: "snmp_server_location", modes: ["global_config"],
    tokens: ["snmp-server", "location", "<text>"],
    help: "snmp-server location <text>",
    description: "Set the device's physical location, reported via the sysLocation MIB object.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: snmp-server contact").
    id: "snmp_server_contact", modes: ["global_config"],
    tokens: ["snmp-server", "contact", "<text>"],
    help: "snmp-server contact <text>",
    description: "Set the administrative contact for this device, reported via the sysContact MIB object.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: snmp-server host").
    id: "snmp_server_host", modes: ["global_config"],
    tokens: ["snmp-server", "host", "<ip>", "version", "<ver>", "<community>"],
    help: "snmp-server host <ip-address> version 2c <community>",
    description: "Set the destination NMS for SNMP trap notifications.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    id: "snmp_server_enable_traps", modes: ["global_config"], tokens: ["snmp-server", "enable", "traps"],
    help: "snmp-server enable traps",
    description: "Enable sending SNMP trap notifications for supported events.",
    handler: function (device) { device.snmpTrapsEnabled = true; return { text: null, error: null }; }
  },
  {
    id: "show_snmp_community", modes: ["priv_exec"], tokens: ["show", "snmp", "community"],
    help: "show snmp community",
    description: "Display configured SNMP community strings and their access levels.",
    handler: function (device) { return { text: renderShowSnmpCommunity(device), error: null }; }
  },
  {
    id: "logging_host", modes: ["global_config"], tokens: ["logging", "host", "<ip>"],
    help: "logging host <ip-address>",
    description: "Set the destination syslog server for log messages.",
    handler: function (device, args) {
      if (!isValidIPv4(args[0])) return { text: null, error: "% Invalid input detected" };
      device.loggingHost = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "logging_trap", modes: ["global_config"], tokens: ["logging", "trap", "<level>"],
    help: "logging trap <level>",
    description: "Set the severity threshold for messages sent to the syslog server (0=emergency ... 7=debug — a lower number is MORE severe). Accepts either the level name (e.g. \"informational\") or its numeric equivalent.",
    handler: function (device, args) { device.loggingTrapLevel = args[0]; return { text: null, error: null }; }
  },
  {
    // Actual execution handled by the special case in executeLine()
    // (see "Special case: logging source-interface").
    id: "logging_source_interface", modes: ["global_config"],
    tokens: ["logging", "source-interface", "<name>"],
    help: "logging source-interface <interface-name>",
    description: "Use this interface's address as the source IP on all outgoing log messages — a loopback interface is common, since it never physically goes down.",
    handler: function () { return { text: null, error: null }; }
  },
  {
    id: "service_timestamps_log", modes: ["global_config"],
    tokens: ["service", "timestamps", "log", "datetime", "msec"],
    help: "service timestamps log datetime msec",
    description: "Add a millisecond-precision timestamp to every logged message — essential for correlating events during troubleshooting or security review.",
    handler: function (device) { device.serviceTimestampsLog = true; return { text: null, error: null }; }
  },
  {
    id: "show_logging", modes: ["priv_exec"], tokens: ["show", "logging"],
    help: "show logging",
    description: "Display logging configuration and destinations — console, buffer, and any configured syslog server.",
    handler: function (device) { return { text: renderShowLogging(device), error: null }; }
  },
  {
    id: "ip_domain_name", modes: ["global_config"], tokens: ["ip", "domain-name", "<name>"],
    help: "ip domain-name <name>",
    description: "Set the device's domain name — required before generating RSA keys for SSH.",
    handler: function (device, args) {
      device.domainName = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "username_secret", modes: ["global_config"],
    tokens: ["username", "<name>", "secret", "<password>"],
    help: "username <name> secret <password>",
    description: "Create a local user account with an encrypted secret, for use with login local.",
    handler: function (device, args) {
      setUser(device, args[0], args[1]);
      return { text: null, error: null };
    }
  },
  {
    id: "username_privilege_secret", modes: ["global_config"],
    tokens: ["username", "<name>", "privilege", "<level>", "secret", "<password>"],
    help: "username <name> privilege <level> secret <password>",
    description: "Create a local user account with a specific privilege level (0-15) and an encrypted secret.",
    handler: function (device, args) {
      setUser(device, args[0], args[2], Number(args[1]));
      return { text: null, error: null };
    }
  },
  {
    id: "crypto_key_generate_rsa", modes: ["global_config"],
    tokens: ["crypto", "key", "generate", "rsa", "modulus", "<bits>"],
    help: "crypto key generate rsa modulus <bits>",
    description: "Generate RSA keys, required to enable SSH. Needs a hostname and domain name to be set first.",
    handler: function (device, args) {
      // Real IOS requires a domain name before this will work — the
      // key name is derived from hostname + domain name (verified
      // against the ground-truth lab script: "R1.cisco.com").
      if (!device.domainName) {
        return {
          text: null,
          error: "% Please define a domain-name first."
        };
      }
      device.cryptoKeysGenerated = true;
      const keyName = device.hostname + "." + device.domainName;
      const bits = args[0];
      const text =
        "The name for the keys will be: " + keyName + "\n" +
        "% The key modulus size is " + bits + " bits\n" +
        "Generating " + bits + " bit RSA keys, keys will be non-exportable...\n" +
        "[OK] (elapsed time was 1 seconds)\n" +
        "%SSH-5-ENABLED: SSH 1.99 has been enabled";
      return { text: text, error: null };
    }
  },
  {
    id: "ip_ssh_version", modes: ["global_config"], tokens: ["ip", "ssh", "version", "<n>"],
    help: "ip ssh version <n>",
    description: "Restrict SSH to a specific protocol version (2 is more secure than 1).",
    handler: function (device, args) {
      device.sshVersion = Number(args[0]);
      return { text: null, error: null };
    }
  },
  {
    id: "ip_ssh_timeout", modes: ["global_config"], tokens: ["ip", "ssh", "time-out", "<sec>"],
    help: "ip ssh time-out <seconds>",
    description: "Set the timeout for SSH session establishment (real IOS default is 120 seconds).",
    handler: function (device, args) {
      device.sshTimeout = Number(args[0]);
      return { text: null, error: null };
    }
  },
  {
    id: "ip_ssh_authentication_retries", modes: ["global_config"],
    tokens: ["ip", "ssh", "authentication-retries", "<n>"],
    help: "ip ssh authentication-retries <n>",
    description: "Set how many failed authentication attempts are allowed before the SSH session disconnects (real IOS default is 3).",
    handler: function (device, args) {
      device.sshAuthRetries = Number(args[0]);
      return { text: null, error: null };
    }
  },
  {
    id: "show_ip_ssh", modes: ["priv_exec"], tokens: ["show", "ip", "ssh"],
    help: "show ip ssh",
    description: "Display SSH status, version, and authentication settings.",
    handler: function (device) { return { text: renderShowIpSsh(device), error: null }; }
  },
  {
    id: "vlan_create", modes: ["global_config", "vlan_config"], tokens: ["vlan", "<id>"],
    help: "vlan <id>",
    // "vlan_config" included as a valid starting mode — bug found in
    // testing (v1.35.0): real IOS lets you jump directly from one
    // VLAN's config context straight to another ("vlan 20" then
    // immediately "vlan 30", no "exit" needed in between), same
    // pattern already correct for "interface"/"line console" since
    // earlier versions, but missed here originally.
    description: "Create (or enter configuration mode for) a VLAN.",
    handler: function (device, args) {
      const id = Number(args[0]);
      if (!Number.isInteger(id) || id < 1 || id > 4094) {
        return { text: null, error: "% Invalid input detected" };
      }
      let text = null;
      if (!device.vlans[id]) {
        device.vlans[id] = { name: "VLAN" + String(id).padStart(4, "0"), status: "active" };
        // Real IOS automatically brings up the matching SVI the
        // moment a new VLAN is created — verified against a real
        // Packet Tracer capture, which showed "%LINK-5-CHANGED:
        // Interface Vlan10, changed state to up" firing immediately
        // on "vlan 10", not from a later "no shutdown". Only fires
        // on genuine first creation, not re-entering an existing VLAN.
        const vlanIfName = "Vlan" + id;
        const iface = getOrCreateInterface(device, vlanIfName);
        iface.shutdown = false;
        text = "%LINK-5-CHANGED: Interface " + vlanIfName + ", changed state to up";
      }
      device.currentVlan = id;
      device.mode = "vlan_config";
      return { text: text, error: null };
    }
  },
  {
    id: "vlan_name", modes: ["vlan_config"], tokens: ["name", "<name>"],
    help: "name <name>",
    description: "Assign a descriptive name to the current VLAN.",
    handler: function (device, args) {
      const newName = args[0];
      const currentId = device.currentVlan;
      // Real IOS warns (but still allows) a duplicate VLAN name —
      // verified against a real capture: "VLAN #20 and #30 have an
      // identical name: Guest(Default)". Lower-numbered VLAN listed
      // first, matching the real message exactly.
      let text = null;
      const otherIds = Object.keys(device.vlans).map(Number).filter(function (id) { return id !== currentId; });
      for (let i = 0; i < otherIds.length; i++) {
        if (device.vlans[otherIds[i]].name === newName) {
          const lower = Math.min(currentId, otherIds[i]);
          const higher = Math.max(currentId, otherIds[i]);
          text = "VLAN #" + lower + " and #" + higher + " have an identical name: " + newName;
          break;
        }
      }
      device.vlans[currentId].name = newName;
      return { text: text, error: null };
    }
  },
  {
    id: "switchport_mode_access", modes: ["interface_config"], tokens: ["switchport", "mode", "access"],
    help: "switchport mode access",
    description: "Set this port to access mode — carries traffic for a single VLAN, used for end devices.",
    handler: function (device) {
      const iface = getOrCreateInterface(device, device.currentInterface);
      iface.switchportMode = "access";
      if (iface.accessVlan === null) iface.accessVlan = 1; // real IOS default
      return { text: null, error: null };
    }
  },
  {
    id: "switchport_access_vlan", modes: ["interface_config"], tokens: ["switchport", "access", "vlan", "<id>"],
    help: "switchport access vlan <id>",
    description: "Assign this access port to a specific VLAN.",
    handler: function (device, args) {
      const id = Number(args[0]);
      const iface = getOrCreateInterface(device, device.currentInterface);
      iface.accessVlan = id;
      // Real IOS auto-creates the VLAN if it doesn't exist yet
      // (confirmed via Cisco's own VLAN Configuration Guide: "If you
      // assign an interface to a VLAN that does not exist, the new
      // VLAN is created"), and brings the matching SVI up if this is
      // the first port assigned to a VLAN that was already
      // administratively idle — verified against a real capture
      // showing "%LINEPROTO-5-UPDOWN: Line protocol on Interface
      // Vlan10, changed state to up" firing on the FIRST
      // "switchport access vlan 10", not on later ones.
      let text = null;
      const vlanIfName = "Vlan" + id;
      const alreadyHadPort = Object.keys(device.interfaces).some(function (n) {
        return n !== device.currentInterface && device.interfaces[n].accessVlan === id;
      });
      if (!device.vlans[id]) {
        device.vlans[id] = { name: "VLAN" + String(id).padStart(4, "0"), status: "active" };
      }
      if (!alreadyHadPort) {
        const vlanIface = getOrCreateInterface(device, vlanIfName);
        vlanIface.shutdown = false;
        text = "%LINEPROTO-5-UPDOWN: Line protocol on Interface " + vlanIfName + ", changed state to up";
      }
      return { text: text, error: null };
    }
  },
  {
    id: "switchport_mode_trunk", modes: ["interface_config"], tokens: ["switchport", "mode", "trunk"],
    help: "switchport mode trunk",
    description: "Set this port to trunk mode — carries traffic for multiple VLANs, used between switches/routers.",
    handler: function (device) {
      const name = device.currentInterface;
      const iface = getOrCreateInterface(device, name);
      iface.switchportMode = "trunk";
      // Real IOS briefly flaps the line protocol down/up when a port
      // renegotiates trunk mode — verified against the ground-truth
      // reference script.
      const text =
        "%LINEPROTO-5-UPDOWN: Line protocol on Interface " + name + ", changed state to down\n" +
        "%LINEPROTO-5-UPDOWN: Line protocol on Interface " + name + ", changed state to up";
      return { text: text, error: null };
    }
  },
  {
    id: "switchport_trunk_native_vlan", modes: ["interface_config"],
    tokens: ["switchport", "trunk", "native", "vlan", "<id>"],
    help: "switchport trunk native vlan <id>",
    description: "Set the native (untagged) VLAN for this trunk — must match on both ends.",
    handler: function (device, args) {
      getOrCreateInterface(device, device.currentInterface).trunkNativeVlan = Number(args[0]);
      return { text: null, error: null };
    }
  },
  {
    id: "switchport_trunk_allowed_vlan", modes: ["interface_config"],
    tokens: ["switchport", "trunk", "allowed", "vlan", "<list>"],
    help: "switchport trunk allowed vlan <id>[,<id>...]",
    description: "Restrict which VLANs are allowed to traverse this trunk.",
    handler: function (device, args) {
      const ids = args[0].split(",").map(function (s) { return Number(s.trim()); });
      if (ids.some(function (n) { return !Number.isInteger(n) || n < 1 || n > 4094; })) {
        return { text: null, error: "% Invalid input detected" };
      }
      getOrCreateInterface(device, device.currentInterface).trunkAllowedVlans = ids;
      return { text: null, error: null };
    }
  },
  {
    id: "switchport_port_security", modes: ["interface_config"],
    tokens: ["switchport", "port-security"],
    help: "switchport port-security",
    description: "Enable port security on this access port with default settings (max 1 MAC, violation mode shutdown).",
    handler: function (device) {
      getOrCreateInterface(device, device.currentInterface).portSecurityEnabled = true;
      return { text: null, error: null };
    }
  },
  {
    id: "switchport_port_security_maximum", modes: ["interface_config"],
    tokens: ["switchport", "port-security", "maximum", "<n>"],
    help: "switchport port-security maximum <n>",
    description: "Set the maximum number of secure MAC addresses allowed on this port.",
    handler: function (device, args) {
      getOrCreateInterface(device, device.currentInterface).portSecurityMax = Number(args[0]);
      return { text: null, error: null };
    }
  },
  {
    id: "switchport_port_security_violation", modes: ["interface_config"],
    tokens: ["switchport", "port-security", "violation", "<mode>"],
    help: "switchport port-security violation <protect|restrict|shutdown>",
    description: "Set what happens when an unauthorized MAC address is seen on this port.",
    handler: function (device, args) {
      const mode = args[0].toLowerCase();
      if (["protect", "restrict", "shutdown"].indexOf(mode) === -1) {
        return { text: null, error: "% Invalid input detected" };
      }
      getOrCreateInterface(device, device.currentInterface).portSecurityViolation = mode;
      return { text: null, error: null };
    }
  },
  {
    id: "switchport_port_security_sticky", modes: ["interface_config"],
    tokens: ["switchport", "port-security", "mac-address", "sticky"],
    help: "switchport port-security mac-address sticky",
    description: "Dynamically learn connected MAC addresses and add them to the running configuration automatically.",
    handler: function (device) {
      getOrCreateInterface(device, device.currentInterface).portSecurityStickyEnabled = true;
      return { text: null, error: null };
    }
  },
  {
    id: "switchport_port_security_sticky_mac", modes: ["interface_config"],
    tokens: ["switchport", "port-security", "mac-address", "sticky", "<mac>"],
    help: "switchport port-security mac-address sticky <mac-address>",
    description: "Manually specify a sticky secure MAC address, instead of waiting for it to be learned from traffic.",
    handler: function (device, args) {
      const mac = args[0];
      if (!/^[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}$/.test(mac)) {
        return { text: null, error: "% Invalid input detected" };
      }
      const iface = getOrCreateInterface(device, device.currentInterface);
      iface.portSecurityStickyEnabled = true;
      if (iface.portSecurityStickyMacs.indexOf(mac) === -1) {
        iface.portSecurityStickyMacs.push(mac);
      }
      return { text: null, error: null };
    }
  },
  {
    id: "show_port_security_interface", modes: ["priv_exec"],
    tokens: ["show", "port-security", "interface", "<name>"],
    help: "show port-security interface <interface-name>",
    description: "Display detailed port security status for one interface.",
    handler: function (device, args) {
      const name = normalizeInterfaceName(args[0]);
      if (!device.interfaces[name]) {
        return { text: null, error: "% Invalid interface" };
      }
      return { text: renderShowPortSecurityInterface(device, name), error: null };
    }
  },
  {
    id: "show_vlan_brief", modes: ["priv_exec"], tokens: ["show", "vlan", "brief"],
    help: "show vlan brief",
    description: "Display all VLANs and the access ports assigned to each.",
    handler: function (device) { return { text: renderShowVlanBrief(device), error: null }; }
  },
  {
    id: "show_interfaces_trunk", modes: ["priv_exec"], tokens: ["show", "interfaces", "<name>", "trunk"],
    help: "show interfaces <interface-name> trunk",
    description: "Display trunk mode, encapsulation, native VLAN, and allowed VLANs for a trunk port.",
    handler: function (device, args) {
      const name = normalizeInterfaceName(args[0]);
      if (!device.interfaces[name]) {
        return { text: null, error: "% Invalid interface" };
      }
      return { text: renderShowInterfacesTrunk(device, name), error: null };
    }
  },
  {
    id: "login_local", modes: ["line_config"], tokens: ["login", "local"],
    help: "login local",
    description: "Require login using the local username database instead of a single line password.",
    handler: function (device) {
      getOrCreateLine(device, device.currentLine).loginLocal = true;
      return { text: null, error: null };
    }
  },
  {
    id: "transport_input_ssh", modes: ["line_config"], tokens: ["transport", "input", "ssh"],
    help: "transport input ssh",
    description: "Restrict this line to SSH connections only, disabling Telnet.",
    handler: function (device) {
      getOrCreateLine(device, device.currentLine).transportInput = "ssh";
      return { text: null, error: null };
    }
  },
  {
    id: "ipv6_address", modes: ["interface_config"], tokens: ["ipv6", "address", "<addrwithprefix>"],
    help: "ipv6 address <address>/<prefix-length>",
    description: "Assign a global IPv6 address and prefix length to the current interface.",
    handler: function (device, args) {
      const parsed = parseIPv6WithPrefix(args[0]);
      if (!parsed) {
        return { text: null, error: "% Invalid input detected at '^' marker." };
      }
      if (!isValidIPv6Address(parsed.address)) {
        return { text: null, error: "% Invalid input detected at '^' marker." };
      }
      const iface = getOrCreateInterface(device, device.currentInterface);
      iface.ipv6Address = parsed.address;
      iface.ipv6PrefixLength = parsed.prefixLength;
      return { text: null, error: null };
    }
  },
  {
    id: "ipv6_address_link_local", modes: ["interface_config"],
    tokens: ["ipv6", "address", "<addr>", "link-local"],
    help: "ipv6 address <address> link-local",
    description: "Assign a link-local IPv6 address to the current interface (no prefix length — always /10, fe80::/10).",
    handler: function (device, args) {
      const addr = args[0];
      if (!isValidIPv6Address(addr)) {
        return { text: null, error: "% Invalid input detected at '^' marker." };
      }
      const iface = getOrCreateInterface(device, device.currentInterface);
      iface.ipv6LinkLocal = addr;
      return { text: null, error: null };
    }
  },
  {
    id: "enable_secret", modes: ["global_config"], tokens: ["enable", "secret", "<password>"],
    help: "enable secret <password>",
    description: "Set an encrypted (MD5) password required to enter privileged EXEC mode. Takes priority over enable password if both are set.",
    handler: function (device, args) {
      device.enableSecret = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "enable_password", modes: ["global_config"], tokens: ["enable", "password", "<password>"],
    help: "enable password <password>",
    description: "Set a weaker, unencrypted-by-default password required to enter privileged EXEC mode. Ignored if enable secret is also set.",
    handler: function (device, args) {
      device.enablePassword = args[0];
      return { text: null, error: null };
    }
  },
  {
    id: "service_password_encryption", modes: ["global_config"],
    tokens: ["service", "password-encryption"],
    help: "service password-encryption",
    description: "Encrypt all plaintext passwords currently configured on the device.",
    handler: function (device) {
      device.servicePasswordEncryption = true;
      return { text: null, error: null };
    }
  },
  {
    id: "exit", modes: ["priv_exec", "global_config", "interface_config", "line_config", "vlan_config", "dhcp_pool_config", "ipv6_dhcp_pool_config", "router_config", "ext_nacl_config"], tokens: ["exit"],
    help: "exit", description: "Move up one configuration level.",
    handler: function (device) {
      let text = null;
      if (device.mode === "interface_config") { device.mode = "global_config"; device.currentInterface = null; }
      else if (device.mode === "line_config") { device.mode = "global_config"; device.currentLine = null; }
      else if (device.mode === "vlan_config") { device.mode = "global_config"; device.currentVlan = null; }
      else if (device.mode === "dhcp_pool_config") { device.mode = "global_config"; device.currentDhcpPool = null; }
      else if (device.mode === "ipv6_dhcp_pool_config") { device.mode = "global_config"; device.currentIpv6DhcpPool = null; }
      else if (device.mode === "router_config") { device.mode = "global_config"; }
      else if (device.mode === "ext_nacl_config") { device.mode = "global_config"; device.currentExtAcl = null; }
      else if (device.mode === "global_config") {
        device.mode = "priv_exec";
        // Real IOS prints this the moment you leave global config mode
        // back to privileged EXEC — verified against a real capture.
        text = "%SYS-5-CONFIG_I: Configured from console by console";
      }
      else if (device.mode === "priv_exec") { device.mode = "user_exec"; }
      return { text: text, error: null };
    }
  },
  {
    id: "end", modes: ["global_config", "interface_config", "line_config", "vlan_config", "dhcp_pool_config", "ipv6_dhcp_pool_config", "router_config", "ext_nacl_config"], tokens: ["end"],
    help: "end", description: "Return directly to privileged EXEC mode.",
    handler: function (device) {
      const wasInGlobalOrBelow = device.mode === "global_config" || device.mode === "interface_config" || device.mode === "line_config" || device.mode === "vlan_config" || device.mode === "dhcp_pool_config" || device.mode === "ipv6_dhcp_pool_config" || device.mode === "router_config" || device.mode === "ext_nacl_config";
      device.mode = "priv_exec"; device.currentInterface = null; device.currentLine = null; device.currentVlan = null; device.currentDhcpPool = null; device.currentIpv6DhcpPool = null; device.currentExtAcl = null;
      const text = wasInGlobalOrBelow ? "%SYS-5-CONFIG_I: Configured from console by console" : null;
      return { text: text, error: null };
    }
  },
  {
    id: "show_running_config", modes: ["priv_exec"], tokens: ["show", "running-config"],
    help: "show running-config", description: "Display the current active configuration.",
    handler: function (device) { return { text: renderRunningConfig(device), error: null }; }
  },
  {
    id: "show_startup_config", modes: ["priv_exec"], tokens: ["show", "startup-config"],
    help: "show startup-config", description: "Display the configuration saved in NVRAM.",
    handler: function (device) { return { text: renderConfigText(device.startupConfig), error: null }; }
  },
  {
    id: "copy_running_startup", modes: ["priv_exec"],
    tokens: ["copy", "running-config", "startup-config"],
    help: "copy running-config startup-config",
    description: "Save the current running configuration to NVRAM as the startup configuration.",
    handler: function (device) {
      device.pendingPrompt = { type: "copy_destination" };
      return { text: "Destination filename [startup-config]? ", error: null };
    }
  },
  {
    id: "erase_startup_config", modes: ["priv_exec"],
    tokens: ["erase", "startup-config"],
    help: "erase startup-config",
    description: "Delete the saved startup configuration from NVRAM.",
    handler: function (device) {
      device.pendingPrompt = { type: "erase_confirm" };
      return {
        text: "Erasing the nvram filesystem will remove all configuration files!\nContinue? [confirm]",
        error: null
      };
    }
  },
  {
    id: "reload", modes: ["priv_exec"], tokens: ["reload"],
    help: "reload", description: "Reboot the device, loading the startup configuration.",
    handler: function (device) {
      if (hasUnsavedChanges(device)) {
        device.pendingPrompt = { type: "reload_save" };
        return { text: "System configuration has been modified. Save? [yes/no]:", error: null };
      }
      device.pendingPrompt = { type: "reload_confirm" };
      return { text: "Proceed with reload? [confirm]", error: null };
    }
  },
  {
    id: "show_ip_interface_brief", modes: ["user_exec", "priv_exec"], tokens: ["show", "ip", "interface", "brief"],
    help: "show ip interface brief", description: "Display a summary table of interface status.",
    handler: function (device) { return { text: renderShowIpIntBrief(device), error: null }; }
  },
  {
    id: "show_ip_route", modes: ["user_exec", "priv_exec"], tokens: ["show", "ip", "route"],
    help: "show ip route",
    description: "Display the IPv4 routing table — directly connected and local routes for now.",
    handler: function (device) { return { text: renderShowIpRoute(device), error: null }; }
  },
  {
    id: "show_ip_route_ospf", modes: ["user_exec", "priv_exec"], tokens: ["show", "ip", "route", "ospf"],
    help: "show ip route ospf",
    description: "Display only OSPF-learned (O) routes in the routing table — useful to confirm route propagation without other route types cluttering the view.",
    handler: function (device) { return { text: renderShowIpRoute(device, "ospf"), error: null }; }
  },
  {
    id: "show_ip_ospf", modes: ["priv_exec"], tokens: ["show", "ip", "ospf"],
    help: "show ip ospf",
    description: "Display OSPF process summary — process ID, router ID, area info.",
    handler: function (device) { return { text: renderShowIpOspf(device), error: null }; }
  },
  {
    id: "show_interfaces_detail", modes: ["user_exec", "priv_exec"], tokens: ["show", "interfaces", "<name>"],
    help: "show interfaces <interface-name>",
    description: "Display detailed status, hardware, and counters for one interface.",
    handler: function (device, args) {
      // Real IOS behavior, confirmed via Cisco documentation (v1.35.0):
      // on some platforms, "show interfaces <Type>" with NO slot/port
      // number is valid and defaults to the first interface of that
      // type (e.g. "show interfaces gigabitethernet" -> "port 0").
      // Detect this by checking whether the typed name resolves to a
      // known interface TYPE with no trailing digits, rather than a
      // full interface name.
      const typedName = args[0];
      if (/^[A-Za-z]+$/.test(typedName)) {
        const resolvedType = INTERFACE_TYPES.find(function (t) {
          return t.toLowerCase().startsWith(typedName.toLowerCase());
        }) || (INTERFACE_TYPES.indexOf(typedName) !== -1 ? typedName : null);
        if (resolvedType) {
          const firstOfType = Object.keys(device.interfaces)
            .filter(function (n) { return n.toLowerCase().startsWith(resolvedType.toLowerCase()); })
            .sort()[0];
          if (firstOfType) {
            return { text: renderShowInterfaceDetail(device, firstOfType), error: null };
          }
          return { text: null, error: "% Invalid interface" };
        }
      }
      const name = normalizeInterfaceName(typedName);
      if (!device.interfaces[name]) {
        return { text: null, error: "% Invalid interface" };
      }
      return { text: renderShowInterfaceDetail(device, name), error: null };
    }
  },
  {
    // Real IOS behavior, confirmed via a Cisco IOS Cookbook reference
    // (v1.35.0): "show interfaces" with NO argument at all shows every
    // interface on the device, one after another (same detail format
    // as naming one specific interface).
    id: "show_interfaces_all", modes: ["user_exec", "priv_exec"], tokens: ["show", "interfaces"],
    help: "show interfaces",
    description: "Display detailed status, hardware, and counters for EVERY interface, one after another.",
    handler: function (device) {
      const names = Object.keys(device.interfaces);
      if (names.length === 0) return { text: "(no interfaces configured)", error: null };
      const blocks = names.map(function (n) { return renderShowInterfaceDetail(device, n); });
      return { text: blocks.join("\n\n"), error: null };
    }
  },
  {
    id: "show_ipv6_interface_brief", modes: ["user_exec", "priv_exec"],
    tokens: ["show", "ipv6", "interface", "brief"],
    help: "show ipv6 interface brief",
    description: "Display a summary of each interface's IPv6 addresses and up/down status.",
    handler: function (device) { return { text: renderShowIpv6IntBrief(device), error: null }; }
  },
  {
    id: "ping", modes: ["user_exec", "priv_exec"], tokens: ["ping", "<ip>"],
    help: "ping <ip-address>",
    description: "Send ICMP echo requests to test reachability to another device.",
    handler: function (device, args) {
      const target = args[0];
      if (!isValidIPv4(target)) {
        return { text: null, error: "% Invalid IP address: " + target };
      }
      return { text: renderPing(device, target), error: null };
    }
  }
];

/* ---------------------------------------------------------
   5. OUTPUT RENDERERS
   --------------------------------------------------------- */

// Simulates IOS "type 7" password obfuscation display. This is NOT real
// Cisco type-7 encryption (that's a reversible XOR cipher) — we don't
// need cryptographic accuracy here, just the visual effect students see
// in show running-config: an unreadable string instead of plaintext.
function obfuscatePassword(pw) {
  let out = "";
  for (let i = 0; i < pw.length; i++) {
    out += String.fromCharCode(((pw.charCodeAt(i) + 13 + i) % 94) + 33);
  }
  return out;
}

// The subset of device state that actually belongs in a saved config
// (i.e. what "copy running-config startup-config" preserves, and what
// survives a reload). Deliberately excludes transient things like
// device.mode, device.currentInterface, device.pendingPrompt.
function snapshotConfig(device) {
  return {
    hostname: device.hostname,
    interfaces: JSON.parse(JSON.stringify(device.interfaces)),
    lines: JSON.parse(JSON.stringify(device.lines)),
    vlans: JSON.parse(JSON.stringify(device.vlans)),
    staticRoutes: JSON.parse(JSON.stringify(device.staticRoutes)),
    dhcpExcludedRanges: JSON.parse(JSON.stringify(device.dhcpExcludedRanges)),
    dhcpPools: JSON.parse(JSON.stringify(device.dhcpPools)),
    ipv6DhcpPools: JSON.parse(JSON.stringify(device.ipv6DhcpPools)),
    ospf: device.ospf ? JSON.parse(JSON.stringify(device.ospf)) : null,
    accessLists: JSON.parse(JSON.stringify(device.accessLists)),
    natStaticRules: JSON.parse(JSON.stringify(device.natStaticRules)),
    natPools: JSON.parse(JSON.stringify(device.natPools)),
    natDynamicRules: JSON.parse(JSON.stringify(device.natDynamicRules)),
    cdpEnabled: device.cdpEnabled, lldpEnabled: device.lldpEnabled,
    ntpMasterStratum: device.ntpMasterStratum, ntpServer: device.ntpServer,
    snmpCommunities: JSON.parse(JSON.stringify(device.snmpCommunities)),
    snmpLocation: device.snmpLocation, snmpContact: device.snmpContact,
    snmpHost: device.snmpHost ? Object.assign({}, device.snmpHost) : null,
    snmpTrapsEnabled: device.snmpTrapsEnabled,
    loggingHost: device.loggingHost, loggingTrapLevel: device.loggingTrapLevel,
    loggingSourceInterface: device.loggingSourceInterface,
    serviceTimestampsLog: device.serviceTimestampsLog,
    enableSecret: device.enableSecret,
    enablePassword: device.enablePassword,
    servicePasswordEncryption: device.servicePasswordEncryption,
    bannerMotd: device.bannerMotd,
    ipDomainLookup: device.ipDomainLookup,
    ipv6UnicastRouting: device.ipv6UnicastRouting,
    users: JSON.parse(JSON.stringify(device.users)),
    domainName: device.domainName,
    securityPasswordsMinLength: device.securityPasswordsMinLength,
    sshVersion: device.sshVersion,
    sshTimeout: device.sshTimeout,
    sshAuthRetries: device.sshAuthRetries,
    loginBlockFor: device.loginBlockFor ? Object.assign({}, device.loginBlockFor) : null,
    cryptoKeysGenerated: device.cryptoKeysGenerated
  };
}

// Applies a saved config snapshot onto a device, e.g. after a reload.
// Mode/interface-context always reset to a fresh boot state — a real
// device doesn't come back up already inside interface config mode.
function applyConfigSnapshot(device, snapshot) {
  device.mode = "user_exec";
  device.currentInterface = null;
  device.currentLine = null;
  if (snapshot === null) {
    // No startup-config present -> boots with factory-default state,
    // including a fresh copy of this device's full interface
    // inventory (not an empty map) — a real device retains its
    // physical interfaces across a reload even with no saved config.
    device.hostname = device.deviceType === "router" ? "Router" : "Switch";
    const model = DEVICE_MODELS[device.deviceType] || DEVICE_MODELS.switch;
    const freshInterfaces = {};
    for (let i = 0; i < model.interfaces.length; i++) {
      const ifName = model.interfaces[i];
      freshInterfaces[ifName] = freshInterfaceState(defaultsUpAtCreation(device.deviceType, ifName));
    }
    device.interfaces = freshInterfaces;
    device.lines = {};
    device.vlans = freshVlanTable();
    device.staticRoutes = [];
    device.dhcpExcludedRanges = [];
    device.dhcpPools = {};
    device.ipv6DhcpPools = {};
    device.ospf = null;
    device.accessLists = {};
    device.natStaticRules = [];
    device.natPools = {};
    device.natDynamicRules = [];
    device.cdpEnabled = true; device.lldpEnabled = false;
    device.ntpMasterStratum = null; device.ntpServer = null;
    device.snmpCommunities = []; device.snmpLocation = null; device.snmpContact = null;
    device.snmpHost = null; device.snmpTrapsEnabled = false;
    device.loggingHost = null; device.loggingTrapLevel = null;
    device.loggingSourceInterface = null; device.serviceTimestampsLog = false;
    device.enableSecret = null;
    device.enablePassword = null;
    device.servicePasswordEncryption = false;
    device.bannerMotd = null;
    device.ipDomainLookup = true;
    device.ipv6UnicastRouting = false;
    device.users = {};
    device.domainName = null;
    device.securityPasswordsMinLength = null;
    device.sshVersion = null;
    device.sshTimeout = null;
    device.sshAuthRetries = null;
    device.loginBlockFor = null;
    device.cryptoKeysGenerated = false;
  } else {
    device.hostname = snapshot.hostname;
    device.interfaces = JSON.parse(JSON.stringify(snapshot.interfaces));
    device.lines = JSON.parse(JSON.stringify(snapshot.lines));
    device.vlans = JSON.parse(JSON.stringify(snapshot.vlans || freshVlanTable()));
    device.staticRoutes = JSON.parse(JSON.stringify(snapshot.staticRoutes || []));
    device.dhcpExcludedRanges = JSON.parse(JSON.stringify(snapshot.dhcpExcludedRanges || []));
    device.dhcpPools = JSON.parse(JSON.stringify(snapshot.dhcpPools || {}));
    device.ipv6DhcpPools = JSON.parse(JSON.stringify(snapshot.ipv6DhcpPools || {}));
    device.ospf = snapshot.ospf ? JSON.parse(JSON.stringify(snapshot.ospf)) : null;
    device.accessLists = JSON.parse(JSON.stringify(snapshot.accessLists || {}));
    device.natStaticRules = JSON.parse(JSON.stringify(snapshot.natStaticRules || []));
    device.natPools = JSON.parse(JSON.stringify(snapshot.natPools || {}));
    device.natDynamicRules = JSON.parse(JSON.stringify(snapshot.natDynamicRules || []));
    device.cdpEnabled = snapshot.cdpEnabled !== undefined ? snapshot.cdpEnabled : true;
    device.lldpEnabled = snapshot.lldpEnabled || false;
    device.ntpMasterStratum = snapshot.ntpMasterStratum !== undefined ? snapshot.ntpMasterStratum : null;
    device.ntpServer = snapshot.ntpServer || null;
    device.snmpCommunities = JSON.parse(JSON.stringify(snapshot.snmpCommunities || []));
    device.snmpLocation = snapshot.snmpLocation || null;
    device.snmpContact = snapshot.snmpContact || null;
    device.snmpHost = snapshot.snmpHost ? Object.assign({}, snapshot.snmpHost) : null;
    device.snmpTrapsEnabled = snapshot.snmpTrapsEnabled || false;
    device.loggingHost = snapshot.loggingHost || null;
    device.loggingTrapLevel = snapshot.loggingTrapLevel || null;
    device.loggingSourceInterface = snapshot.loggingSourceInterface || null;
    device.serviceTimestampsLog = snapshot.serviceTimestampsLog || false;
    device.enableSecret = snapshot.enableSecret;
    device.enablePassword = snapshot.enablePassword;
    device.servicePasswordEncryption = snapshot.servicePasswordEncryption;
    device.bannerMotd = snapshot.bannerMotd;
    device.ipDomainLookup = snapshot.ipDomainLookup;
    device.ipv6UnicastRouting = snapshot.ipv6UnicastRouting;
    device.users = JSON.parse(JSON.stringify(snapshot.users || {}));
    device.domainName = snapshot.domainName;
    device.securityPasswordsMinLength = snapshot.securityPasswordsMinLength;
    device.sshVersion = snapshot.sshVersion;
    device.sshTimeout = snapshot.sshTimeout;
    device.sshAuthRetries = snapshot.sshAuthRetries;
    device.loginBlockFor = snapshot.loginBlockFor ? Object.assign({}, snapshot.loginBlockFor) : null;
    device.cryptoKeysGenerated = snapshot.cryptoKeysGenerated;
  }
}

// Renders a config snapshot (or the live device, since it has the same
// shape) as IOS-style config text. Used for both "show running-config"
// (pass the device) and "show startup-config" (pass device.startupConfig).
function renderConfigText(source) {
  if (source === null) {
    return "startup-config is not present";
  }
  // Build the config BODY first (everything after "Current configuration"
  // line) so we can report its length, matching real IOS which shows
  // "Current configuration : N bytes" — verified against a real Packet
  // Tracer capture, which included this line right after the blank
  // line and before the first "!". We were previously missing it
  // entirely.
  const bodyLines = ["hostname " + source.hostname, "!"];
  if (source.serviceTimestampsLog) {
    bodyLines.push("service timestamps log datetime msec");
    bodyLines.push("!");
  }
  // "lldp run" — real IOS position confirmed via a real capture:
  // appears early in the config (near the "ip cef"/boilerplate
  // section this project doesn't otherwise render), well before
  // interface/security blocks. "cdp run" NEVER appears in
  // running-config at all — also confirmed via the same real
  // capture — since CDP is on by default; the command only exists to
  // re-enable it after "no cdp run", which isn't tracked as a config
  // line either way in real IOS.
  if (source.lldpEnabled) {
    bodyLines.push("lldp run");
    bodyLines.push("!");
  }
  if (source.enableSecret) {
    const shown = source.servicePasswordEncryption ? obfuscatePassword(source.enableSecret) : source.enableSecret;
    bodyLines.push("enable secret 5 " + shown);
  }
  if (source.enablePassword) {
    // Real IOS only shows "enable password" with a "7 " prefix (type-7
    // obfuscation marker) when service password-encryption is on; when
    // off, it's shown in plaintext with no prefix at all — verified
    // against a real Packet Tracer capture.
    const shown = source.servicePasswordEncryption ? obfuscatePassword(source.enablePassword) : source.enablePassword;
    bodyLines.push("enable password " + (source.servicePasswordEncryption ? "7 " : "") + shown);
  }
  if (source.servicePasswordEncryption) {
    bodyLines.push("service password-encryption");
  }
  bodyLines.push("!");
  if (source.ipDomainLookup === false) {
    bodyLines.push("no ip domain-lookup");
    bodyLines.push("!");
  }
  if (source.ipv6UnicastRouting) {
    bodyLines.push("ipv6 unicast-routing");
    bodyLines.push("!");
  }
  if (source.securityPasswordsMinLength !== null && source.securityPasswordsMinLength !== undefined) {
    bodyLines.push("security passwords min-length " + source.securityPasswordsMinLength);
    bodyLines.push("!");
  }
  if (source.loginBlockFor) {
    bodyLines.push("login block-for " + source.loginBlockFor.seconds + " attempts " + source.loginBlockFor.attempts + " within " + source.loginBlockFor.within);
    bodyLines.push("!");
  }
  // Access lists — defined before interfaces (which reference them),
  // matching the natural "define then use" order real IOS configs
  // follow. Standard (numbered) ACLs render as flat "access-list <n>
  // ..." lines; extended (named) ACLs render as "ip access-list
  // extended <name>" followed by INDENTED entries — matching each
  // type's own real config-mode syntax, not a single shared format.
  if (source.accessLists) {
    const aclNames = Object.keys(source.accessLists);
    for (let i = 0; i < aclNames.length; i++) {
      const name = aclNames[i];
      const acl = source.accessLists[name];
      if (acl.type === "extended") {
        bodyLines.push("ip access-list extended " + name);
        for (let e = 0; e < acl.entries.length; e++) {
          bodyLines.push(" " + renderAclEntry(acl.entries[e]));
        }
      } else {
        for (let e = 0; e < acl.entries.length; e++) {
          bodyLines.push("access-list " + name + " " + renderAclEntry(acl.entries[e]));
        }
      }
    }
    if (aclNames.length > 0) bodyLines.push("!");
  }
  // DHCP config — verified against a real capture: excluded-address
  // lines come first, each pool follows with network/default-router/
  // dns-server/domain-name in that exact order, positioned right
  // after security settings and before interfaces.
  if (source.dhcpExcludedRanges && source.dhcpExcludedRanges.length > 0) {
    for (let i = 0; i < source.dhcpExcludedRanges.length; i++) {
      const r = source.dhcpExcludedRanges[i];
      bodyLines.push("ip dhcp excluded-address " + r.start + " " + r.end);
    }
    bodyLines.push("!");
  }
  if (source.dhcpPools) {
    const poolNames = Object.keys(source.dhcpPools);
    for (let i = 0; i < poolNames.length; i++) {
      const name = poolNames[i];
      const pool = source.dhcpPools[name];
      bodyLines.push("ip dhcp pool " + name);
      if (pool.network && pool.mask) bodyLines.push(" network " + pool.network + " " + pool.mask);
      if (pool.defaultRouter) bodyLines.push(" default-router " + pool.defaultRouter);
      if (pool.dnsServer) bodyLines.push(" dns-server " + pool.dnsServer);
      if (pool.domainName) bodyLines.push(" domain-name " + pool.domainName);
      bodyLines.push("!");
    }
  }
  if (source.ipv6DhcpPools) {
    const v6PoolNames = Object.keys(source.ipv6DhcpPools);
    for (let i = 0; i < v6PoolNames.length; i++) {
      const name = v6PoolNames[i];
      const pool = source.ipv6DhcpPools[name];
      bodyLines.push("ipv6 dhcp pool " + name);
      if (pool.addressPrefix) bodyLines.push(" address prefix " + pool.addressPrefix);
      if (pool.dnsServer) bodyLines.push(" dns-server " + pool.dnsServer);
      if (pool.domainName) bodyLines.push(" domain-name " + pool.domainName);
      bodyLines.push("!");
    }
  }
  if (source.domainName) {
    bodyLines.push("ip domain-name " + source.domainName);
    bodyLines.push("!");
  }
  const userNames = Object.keys(source.users || {});
  for (let i = 0; i < userNames.length; i++) {
    const uname = userNames[i];
    const userEntry = source.users[uname];
    const secret = userEntry.secret;
    const shown = source.servicePasswordEncryption ? obfuscatePassword(secret) : secret;
    const privilegePart = (userEntry.privilege !== null && userEntry.privilege !== undefined) ? "privilege " + userEntry.privilege + " " : "";
    bodyLines.push("username " + uname + " " + privilegePart + "secret " + (source.servicePasswordEncryption ? "5 " : "") + shown);
  }
  if (userNames.length > 0) bodyLines.push("!");
  if (source.sshVersion) {
    bodyLines.push("ip ssh version " + source.sshVersion);
    bodyLines.push("!");
  }
  if (source.sshTimeout !== null && source.sshTimeout !== undefined) {
    bodyLines.push("ip ssh time-out " + source.sshTimeout);
    bodyLines.push("!");
  }
  if (source.sshAuthRetries !== null && source.sshAuthRetries !== undefined) {
    bodyLines.push("ip ssh authentication-retries " + source.sshAuthRetries);
    bodyLines.push("!");
  }
  const ifNames = Object.keys(source.interfaces);
  for (let i = 0; i < ifNames.length; i++) {
    const name = ifNames[i], iface = source.interfaces[name];
    bodyLines.push("interface " + name);
    if (iface.description) bodyLines.push(" description " + iface.description);
    // Real IOS order for a subinterface (verified against a real
    // capture, v1.35.0): "encapsulation dot1Q <id>" comes BEFORE
    // "ip address" — and subinterfaces show NO shutdown/no shutdown
    // line at all (they have no independent admin-up/down state,
    // only the parent physical interface does — see the cascading
    // "no shutdown" behavior in the no_shutdown command handler).
    if (iface.dot1qVlan !== null) {
      bodyLines.push(" encapsulation dot1Q " + iface.dot1qVlan + (iface.dot1qNative ? " native" : ""));
    }
    if (iface.ip && iface.mask) bodyLines.push(" ip address " + iface.ip + " " + iface.mask);
    // Real IOS order, verified against a real capture: "ip nat
    // inside"/"ip nat outside" appears immediately after "ip
    // address", before anything else on the interface.
    if (iface.natRole) bodyLines.push(" ip nat " + iface.natRole);
    // Real IOS order (verified against a real capture): link-local
    // line comes before the global /prefix address line.
    if (iface.ipv6LinkLocal) {
      bodyLines.push(" ipv6 address " + formatIPv6Display(iface.ipv6LinkLocal) + " link-local");
    }
    if (iface.ipv6Address) {
      bodyLines.push(" ipv6 address " + formatIPv6Display(iface.ipv6Address) + "/" + iface.ipv6PrefixLength);
    }
    if (iface.ipv6OtherConfigFlag) bodyLines.push(" ipv6 nd other-config-flag");
    if (iface.ipv6ManagedConfigFlag) bodyLines.push(" ipv6 nd managed-config-flag");
    if (iface.ipv6DhcpServerPool) bodyLines.push(" ipv6 dhcp server " + iface.ipv6DhcpServerPool);
    if (iface.ospfMd5KeyId !== null) bodyLines.push(" ip ospf message-digest-key " + iface.ospfMd5KeyId + " md5 " + iface.ospfMd5Key);
    // Deliberately NOT rendering "lldp transmit"/"lldp receive" here:
    // a real capture configured both and NEITHER line appeared in
    // "show running-config" — honored exactly as captured rather than
    // assumed, even though it's a genuinely surprising real IOS
    // behavior (possibly because these are the enabled DEFAULTS once
    // "lldp run" is on, so setting them explicitly adds no new
    // config line — not confirmed either way, flagged honestly).
    if (iface.ospfMd5AuthEnabled) bodyLines.push(" ip ospf authentication message-digest");
    if (iface.ospfPriority !== 1) bodyLines.push(" ip ospf priority " + iface.ospfPriority);
    if (iface.ospfHelloInterval !== 10) bodyLines.push(" ip ospf hello-interval " + iface.ospfHelloInterval);
    if (iface.ospfDeadInterval !== 40) bodyLines.push(" ip ospf dead-interval " + iface.ospfDeadInterval);
    if (iface.inboundAccessList) bodyLines.push(" ip access-group " + iface.inboundAccessList + " in");
    if (iface.outboundAccessList) bodyLines.push(" ip access-group " + iface.outboundAccessList + " out");
    // switchport lines — verified against a real "show run | begin
    // interface" capture (v1.35.0): "switchport mode access" appears
    // as its own line, and port-security settings follow in the order
    // shown below (enable -> sticky flag -> violation mode -> any
    // explicitly-configured sticky MAC addresses, each as their own
    // line). This was a real gap fixed in this same version — switchport
    // mode/VLAN/trunk settings were never rendered in show
    // running-config at all before v1.35.0, even though 3.2/3.3 already
    // configured them.
    if (iface.switchportMode === "access") {
      bodyLines.push(" switchport mode access");
      if (iface.accessVlan !== null && iface.accessVlan !== 1) {
        bodyLines.push(" switchport access vlan " + iface.accessVlan);
      }
    } else if (iface.switchportMode === "trunk") {
      bodyLines.push(" switchport mode trunk");
      if (iface.trunkNativeVlan !== null) {
        bodyLines.push(" switchport trunk native vlan " + iface.trunkNativeVlan);
      }
      if (iface.trunkAllowedVlans !== null) {
        bodyLines.push(" switchport trunk allowed vlan " + iface.trunkAllowedVlans.join(","));
      }
    }
    if (iface.portSecurityEnabled) {
      bodyLines.push(" switchport port-security");
      if (iface.portSecurityStickyEnabled) {
        bodyLines.push(" switchport port-security mac-address sticky");
      }
      if (iface.portSecurityMax !== 1) {
        bodyLines.push(" switchport port-security maximum " + iface.portSecurityMax);
      }
      if (iface.portSecurityViolation !== "shutdown") {
        bodyLines.push(" switchport port-security violation " + iface.portSecurityViolation);
      }
      for (let m = 0; m < iface.portSecurityStickyMacs.length; m++) {
        bodyLines.push(" switchport port-security mac-address sticky " + iface.portSecurityStickyMacs[m]);
      }
    }
    if (!isSubinterfaceName(name)) {
      bodyLines.push(iface.shutdown ? " shutdown" : " no shutdown");
    }
    bodyLines.push("!");
  }
  // NAT config — real IOS position confirmed via a real capture:
  // "ip nat pool"/"ip nat inside source ..." lines appear right after
  // interfaces, before "ip classless". Static entries verified with a
  // REAL trailing space after each line (worth preserving exactly).
  if (source.natPools) {
    const poolNames = Object.keys(source.natPools);
    for (let i = 0; i < poolNames.length; i++) {
      const pool = source.natPools[poolNames[i]];
      bodyLines.push("ip nat pool " + poolNames[i] + " " + pool.start + " " + pool.end + " netmask " + pool.netmask);
    }
  }
  if (source.natDynamicRules) {
    for (let i = 0; i < source.natDynamicRules.length; i++) {
      const r = source.natDynamicRules[i];
      if (r.poolName) {
        bodyLines.push("ip nat inside source list " + r.aclNumber + " pool " + r.poolName + (r.overload ? " overload" : ""));
      } else {
        bodyLines.push("ip nat inside source list " + r.aclNumber + " interface " + r.interfaceName + " overload");
      }
    }
  }
  if (source.natStaticRules && source.natStaticRules.length > 0) {
    for (let i = 0; i < source.natStaticRules.length; i++) {
      const r = source.natStaticRules[i];
      // Real capture confirmed a trailing space after each of these
      // lines — deliberately preserved here, not a formatting mistake.
      bodyLines.push("ip nat inside source static " + r.localIp + " " + r.globalIp + " ");
    }
  }
  // "router ospf" block — real IOS position confirmed via a real
  // capture: appears right after the interface blocks, before "ip
  // classless" and static routes.
  if (source.ospf) {
    bodyLines.push("router ospf " + source.ospf.processId);
    bodyLines.push(" log-adjacency-changes");
    if (source.ospf.routerId) bodyLines.push(" router-id " + source.ospf.routerId);
    for (let i = 0; i < source.ospf.networks.length; i++) {
      const n = source.ospf.networks[i];
      bodyLines.push(" network " + n.network + " " + n.wildcard + " area " + n.area);
    }
    for (let i = 0; i < source.ospf.passiveInterfaces.length; i++) {
      bodyLines.push(" passive-interface " + source.ospf.passiveInterfaces[i]);
    }
    if (source.ospf.referenceBandwidth !== 100) {
      bodyLines.push(" auto-cost reference-bandwidth " + source.ospf.referenceBandwidth);
    }
    bodyLines.push("!");
  }
  // Static routes — real IOS lists these after the interface blocks,
  // sorted numerically by network address (matching the same
  // ordering convention already used for show ip route), each with
  // the admin distance shown ONLY if it's non-default (1), since real
  // IOS omits a redundant "1" for ordinary static routes but shows an
  // explicit AD for floating ones.
  if (source.staticRoutes && source.staticRoutes.length > 0) {
    const sortedRoutes = source.staticRoutes.slice().sort(function (a, b) {
      return ipToInt(a.network) - ipToInt(b.network);
    });
    for (let i = 0; i < sortedRoutes.length; i++) {
      const r = sortedRoutes[i];
      const adPart = r.adminDistance !== 1 ? " " + r.adminDistance : "";
      bodyLines.push("ip route " + r.network + " " + r.mask + " " + r.nextHop + adPart);
    }
    bodyLines.push("!");
  }
  // NTP config — real IOS convention places "ntp master"/"ntp
  // server" lines near the end of the config, close to the line
  // con/vty blocks (not verified via a real capture for THIS
  // project specifically — bug found in testing, v1.35.0: these were
  // tracked in device state and used correctly by "show ntp status"/
  // "show ntp associations", but never actually rendered in "show
  // running-config" at all).
  if (source.ntpMasterStratum !== null) {
    bodyLines.push("ntp master " + source.ntpMasterStratum);
    bodyLines.push("!");
  }
  if (source.ntpServer) {
    bodyLines.push("ntp server " + source.ntpServer);
    bodyLines.push("!");
  }
  // SNMP/Syslog config — positioned near NTP, matching the same
  // general "late in the config, near line con/vty" real IOS
  // convention. NOT verified against a real capture for this project
  // specifically (see the note above renderShowSnmpCommunity/
  // renderShowLogging) — built directly from what these commands
  // configure, in the order they were typed in the ground-truth
  // reference.
  for (let i = 0; i < source.snmpCommunities.length; i++) {
    const c = source.snmpCommunities[i];
    bodyLines.push("snmp-server community " + c.string + " " + c.access);
  }
  if (source.snmpLocation) bodyLines.push("snmp-server location " + source.snmpLocation);
  if (source.snmpContact) bodyLines.push("snmp-server contact " + source.snmpContact);
  if (source.snmpHost) bodyLines.push("snmp-server host " + source.snmpHost.ip + " version " + source.snmpHost.version + " " + source.snmpHost.community);
  if (source.snmpTrapsEnabled) bodyLines.push("snmp-server enable traps");
  if (source.snmpCommunities.length > 0 || source.snmpLocation || source.snmpContact || source.snmpHost || source.snmpTrapsEnabled) {
    bodyLines.push("!");
  }
  if (source.loggingHost) bodyLines.push("logging host " + source.loggingHost);
  if (source.loggingTrapLevel) bodyLines.push("logging trap " + source.loggingTrapLevel);
  if (source.loggingSourceInterface) bodyLines.push("logging source-interface " + source.loggingSourceInterface);
  if (source.loggingHost || source.loggingTrapLevel || source.loggingSourceInterface) {
    bodyLines.push("!");
  }
  const lineNames = Object.keys(source.lines);
  for (let i = 0; i < lineNames.length; i++) {
    const name = lineNames[i], line = source.lines[name];
    bodyLines.push("line " + name);
    if (line.password) {
      const shown = source.servicePasswordEncryption ? obfuscatePassword(line.password) : line.password;
      bodyLines.push(" password " + (source.servicePasswordEncryption ? "7 " : "") + shown);
    }
    if (line.login) bodyLines.push(" login");
    if (line.loginLocal) bodyLines.push(" login local");
    if (line.transportInput) bodyLines.push(" transport input " + line.transportInput);
    if (line.loggingSynchronous) bodyLines.push(" logging synchronous");
    if (line.execTimeoutMinutes !== undefined) {
      bodyLines.push(" exec-timeout " + line.execTimeoutMinutes + " " + line.execTimeoutSeconds);
    }
    bodyLines.push("!");
  }
  if (source.bannerMotd) {
    bodyLines.push("banner motd ^C" + source.bannerMotd + "^C");
    bodyLines.push("!");
  }
  bodyLines.push("end");

  const bodyText = bodyLines.join("\n");
  const byteCount = bodyText.length + 1; // +1 for real IOS counting the final newline

  const lines = [
    "Building configuration...",
    "Current configuration : " + byteCount + " bytes"
  ].concat(bodyLines);
  return lines.join("\n");
}

// Compares live device config against the saved startup-config, to
// know whether "reload" should warn about unsaved changes. A device
// that has never been configured/saved (both sides empty/null in the
// ways that matter) should NOT be treated as having unsaved changes.
function hasUnsavedChanges(device) {
  const current = snapshotConfig(device);
  const saved = device.startupConfig;

  if (saved === null) {
    // Nothing ever saved — only "unsaved" if the live config actually
    // differs from a truly blank/default device of this SAME device
    // type (a fresh router/switch now has a real interface inventory,
    // not an empty map — the comparator must build a matching fresh
    // inventory rather than assume {} like before device models
    // existed, or every fresh device would incorrectly appear to
    // have "unsaved changes" the moment it's created).
    const model = DEVICE_MODELS[device.deviceType] || DEVICE_MODELS.switch;
    const freshInterfaces = {};
    for (let i = 0; i < model.interfaces.length; i++) {
      const ifName = model.interfaces[i];
      freshInterfaces[ifName] = freshInterfaceState(defaultsUpAtCreation(device.deviceType, ifName));
    }
    const freshBlank = {
      hostname: device.deviceType === "router" ? "Router" : "Switch",
      interfaces: freshInterfaces, lines: {}, vlans: freshVlanTable(), staticRoutes: [],
      dhcpExcludedRanges: [], dhcpPools: {}, ipv6DhcpPools: {}, ospf: null, accessLists: {},
      natStaticRules: [], natPools: {}, natDynamicRules: [],
      cdpEnabled: true, lldpEnabled: false, ntpMasterStratum: null, ntpServer: null,
      snmpCommunities: [], snmpLocation: null, snmpContact: null, snmpHost: null, snmpTrapsEnabled: false,
      loggingHost: null, loggingTrapLevel: null, loggingSourceInterface: null, serviceTimestampsLog: false,
      enableSecret: null, enablePassword: null,
      servicePasswordEncryption: false, bannerMotd: null, ipDomainLookup: true,
      ipv6UnicastRouting: false, users: {}, domainName: null,
      securityPasswordsMinLength: null, sshVersion: null, sshTimeout: null,
      sshAuthRetries: null, loginBlockFor: null, cryptoKeysGenerated: false
    };
    return JSON.stringify(current) !== JSON.stringify(freshBlank);
  }

  return JSON.stringify(current) !== JSON.stringify(saved);
}

function renderRunningConfig(device) {
  return renderConfigText(device);
}

function padRow(cells, widths) {
  return cells.map(function (c, i) { return String(c).padEnd(widths[i]); }).join("");
}

function renderShowIpIntBrief(device) {
  // Column widths verified against a real Packet Tracer capture:
  // Interface=23, IP-Address=16, OK?=4, Method=7, Status=22, and the
  // final Protocol column is NOT padded to a fixed width — it's just
  // printed as-is after a single space. This matters specifically for
  // "administratively down" (21 chars), which almost fills the
  // 22-wide Status field, leaving only one space before Protocol —
  // our previous fixed-width-everything approach produced trailing
  // padding after Protocol that real IOS never has.
  const widths = [23, 16, 4, 7, 22];
  function formatRow(cells) {
    let line = "";
    for (let i = 0; i < 5; i++) {
      // Real IOS always guarantees at least ONE space between
      // columns, even if a value (like a long subinterface name,
      // e.g. "GigabitEthernet0/0/0.10" at exactly 23 chars) reaches
      // or exceeds the nominal column width — bug found in testing
      // (v1.35.0): padEnd() alone produces ZERO separation in that
      // exact case, since the string is already >= the pad target.
      const cell = String(cells[i]);
      line += cell.length >= widths[i] ? cell + " " : cell.padEnd(widths[i]);
    }
    line += cells[5]; // Protocol: unpadded
    return line;
  }
  const rows = [formatRow(["Interface", "IP-Address", "OK?", "Method", "Status", "Protocol"])];
  const names = Object.keys(device.interfaces);
  if (names.length === 0) { rows.push("(no interfaces configured)"); return rows.join("\n"); }
  for (let i = 0; i < names.length; i++) {
    const name = names[i], iface = device.interfaces[name];
    const hasIp = !!iface.ip;
    const ip = iface.ip || "unassigned";
    // Real IOS: OK? is essentially always YES in normal operation (it
    // reflects config validity, not whether an IP is assigned) — this
    // was WRONG in earlier versions, which tied OK? to whether an IP
    // was configured. Corrected after a real router capture showed
    // "GigabitEthernet0/1  unassigned  YES  unset  administratively
    // down  down" — OK? is YES even with no IP at all. Method is what
    // actually reflects IP configuration: "unset" when no IP was ever
    // configured, "manual" once one has been — verified in the same
    // capture and consistent with earlier captures.
    const ok = "YES";
    const method = hasIp ? "manual" : "unset";
    const status = iface.shutdown ? "administratively down" : "up";
    const protocol = iface.shutdown ? "down" : "up";
    rows.push(formatRow([name, ip, ok, method, status, protocol]));
  }
  return rows.join("\n");
}

// Format verified against a real router capture. Groups routes by
// major (classful-style) network — the /24 the configured /27 (etc.)
// falls within — with a "variably subnetted" summary line, then one
// C (connected) and one L (local /32) line per interface that has an
// IP and is up. Only directly-connected/local routes are modeled —
// no static or dynamic routing protocols, consistent with this being
// a single-device engine for now (see project backlog).
// Rebuilt in v1.35.0 to support static routes (ip route command),
// including real administrative-distance route selection: when a
// floating static route (higher AD) exists for the SAME
// destination network+mask as another route, only the lowest-AD
// route is shown — the floating one stays hidden until the primary
// is removed, matching real IOS behavior confirmed against the
// ground-truth reference for 16.2 (Floating Static Routes). Also
// handles the 0.0.0.0/0 default route specially, shown outside the
// normal "variably subnetted" grouping with the S* code and a real
// "Gateway of last resort" line (previously always hardcoded to
// "not set").
function renderShowIpRoute(device, filter) {
  const codesBlock = [
    "Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP",
    "       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area",
    "       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2",
    "       E1 - OSPF external type 1, E2 - OSPF external type 2, E - EGP",
    "       i - IS-IS, L1 - IS-IS level-1, L2 - IS-IS level-2, ia - IS-IS inter area",
    "       * - candidate default, U - per-user static route, o - ODR",
    "       P - periodic downloaded static route",
    ""
  ];

  // Collect active (IP configured + up) interfaces as connected/local
  // route candidates, AD 0 (always wins route selection).
  const names = Object.keys(device.interfaces);
  const connectedCandidates = [];
  for (let i = 0; i < names.length; i++) {
    const iface = device.interfaces[names[i]];
    if (iface.ip && iface.mask && !iface.shutdown) {
      const netAddr = networkAddress(iface.ip, iface.mask);
      const prefix = maskToPrefixLength(iface.mask);
      connectedCandidates.push({
        destKey: netAddr + "/" + prefix, network: netAddr, prefix: prefix,
        adminDistance: 0, kind: "connected", ifaceName: names[i], ip: iface.ip
      });
    }
  }

  // Static route candidates from "ip route" commands.
  const staticCandidates = device.staticRoutes.map(function (r) {
    const netAddr = networkAddress(r.network, r.mask);
    const prefix = maskToPrefixLength(r.mask);
    return {
      destKey: netAddr + "/" + prefix, network: netAddr, prefix: prefix,
      adminDistance: r.adminDistance, kind: "static", nextHop: r.nextHop
    };
  });

  // OSPF route candidates — one simulated learned route per
  // OSPF-enabled, non-passive interface, representing "a network on
  // the far side of this neighbor" — consistent with this project's
  // neighbor-simulation approach elsewhere (show ip ospf neighbor,
  // show ip protocol). AD 110 matches real OSPF's default
  // administrative distance. Cost uses the same reference-bandwidth
  // formula as show ip ospf interface, plus a flat +1 to represent
  // one additional hop through the simulated neighbor.
  const ospfCandidates = [];
  if (device.ospf) {
    const enabled = getOspfEnabledInterfaces(device).filter(function (e) {
      return device.ospf.passiveInterfaces.indexOf(e.name) === -1;
    });
    for (let i = 0; i < enabled.length; i++) {
      const iface = enabled[i].iface;
      const n = getSimulatedOspfNeighbor(device, enabled[i].name, iface);
      const bw = /^Serial/i.test(enabled[i].name) ? 1544 : 1000000;
      const cost = Math.max(1, Math.floor((device.ospf.referenceBandwidth * 1000) / bw)) + 1;
      // Simulated far-side network: same /24 as the neighbor's own
      // address, but a DIFFERENT subnet than the local link — offset
      // by +1 in the third octet, kept deterministic (not random) so
      // it's stable across repeated show commands.
      const farParts = n.neighborIp.split(".").map(Number);
      const farNetwork = farParts[0] + "." + farParts[1] + "." + ((farParts[2] + 10) % 256) + ".0";
      const prefix = 24;
      ospfCandidates.push({
        destKey: farNetwork + "/" + prefix, network: farNetwork, prefix: prefix,
        adminDistance: 110, kind: "ospf", nextHop: n.neighborIp, ifaceName: enabled[i].name, cost: cost
      });
    }
  }

  // Route selection: group ALL candidates (connected + static + ospf)
  // by destination network+prefix, keep only the LOWEST admin
  // distance per destination — this is what makes floating static
  // routes stay hidden until their lower-AD sibling is removed, and
  // now also means a connected or lower-AD static route always wins
  // over a same-destination OSPF route, matching real AD-based route
  // selection.
  const byDest = {};
  connectedCandidates.concat(staticCandidates).concat(ospfCandidates).forEach(function (c) {
    if (!byDest[c.destKey] || c.adminDistance < byDest[c.destKey].adminDistance) {
      byDest[c.destKey] = c;
    }
  });
  const winners = Object.keys(byDest).map(function (k) { return byDest[k]; });

  // "show ip route ospf" — a fundamentally simpler flat rendering,
  // verified against the real ground-truth reference: just the OSPF
  // routes as plain lines, no "variably subnetted" grouping headers,
  // and a short "Codes: O - OSPF" line instead of the full codes
  // legend.
  if (filter === "ospf") {
    const ospfWinners = winners.filter(function (w) { return w.kind === "ospf"; });
    const flines = ["Codes: O - OSPF", ""];
    ospfWinners.sort(function (a, b) { return ipToInt(a.network) - ipToInt(b.network); });
    for (let i = 0; i < ospfWinners.length; i++) {
      const w = ospfWinners[i];
      flines.push("O     " + w.network + "/" + w.prefix + " [110/" + w.cost + "] via " + w.nextHop + ", " + w.ifaceName);
    }
    return flines.join("\n");
  }

  // The default route (0.0.0.0/0) is handled separately from the
  // "variably subnetted" grouping — real IOS shows it as its own S*
  // line right after "Gateway of last resort", not grouped with any
  // major network.
  const defaultRoute = winners.find(function (w) { return w.network === "0.0.0.0" && w.prefix === 0; });
  const nonDefaultWinners = winners.filter(function (w) { return !(w.network === "0.0.0.0" && w.prefix === 0); });

  const lines = codesBlock.slice();
  if (defaultRoute && defaultRoute.kind === "static") {
    lines.push("Gateway of last resort is " + defaultRoute.nextHop + " to network 0.0.0.0");
  } else {
    lines.push("Gateway of last resort is not set");
  }
  lines.push("");

  if (defaultRoute && defaultRoute.kind === "static") {
    lines.push("S*    0.0.0.0/0 [" + defaultRoute.adminDistance + "/0] via " + defaultRoute.nextHop);
  }

  if (nonDefaultWinners.length === 0 && !defaultRoute) {
    return lines.join("\n").replace(/\n+$/, "");
  }

  // Groups routes by their real CLASSFUL major network (not just a
  // fixed /24 assumption) — bug found in testing (v1.35.0): a real
  // capture showed a static route (172.16.1.0/24) and a connected
  // route (172.16.2.0/24) grouped TOGETHER under one
  // "172.16.0.0/24 is subnetted, 2 subnets" header, not as two
  // separate groups — because both belong to the same Class B major
  // network (172.16.0.0/16), even though neither route itself is a
  // /16. Real IOS also uses "is subnetted" (no "variably") when every
  // route in the group shares the SAME prefix length, reserving
  // "is variably subnetted" for when prefix lengths differ within
  // the group (e.g. a connected /24 route sitting alongside its own
  // /32 local route).
  function classfulMajorNetwork(ip) {
    const firstOctet = Number(ip.split(".")[0]);
    const parts = ip.split(".").map(Number);
    if (firstOctet <= 127) return parts[0] + ".0.0.0"; // Class A, /8
    if (firstOctet <= 191) return parts[0] + "." + parts[1] + ".0.0"; // Class B, /16
    return parts[0] + "." + parts[1] + "." + parts[2] + ".0"; // Class C, /24
  }

  const groups = {};
  const groupOrder = [];
  for (let i = 0; i < nonDefaultWinners.length; i++) {
    const w = nonDefaultWinners[i];
    const key = classfulMajorNetwork(w.network);
    if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
    groups[key].push(w);
  }

  // Real IOS sorts the routing table numerically by network address,
  // not by configuration order — verified against a real capture
  // where a Serial interface (209.165.200.x) configured AFTER a
  // GigabitEthernet interface (209.165.201.x) still appeared FIRST
  // in the output, since 200 < 201 numerically.
  groupOrder.sort(function (a, b) { return ipToInt(a) - ipToInt(b); });

  for (let g = 0; g < groupOrder.length; g++) {
    const key = groupOrder[g];
    const entries = groups[key];
    // Within a group, connected routes' /32 local entries only apply
    // to connected candidates (a static route has no separate local
    // /32 line) — subnet count reflects that.
    let subnetCount = 0;
    entries.forEach(function (e) { subnetCount += e.kind === "connected" ? 2 : 1; });
    // Determine display prefix length: if every route in the group
    // shares the same prefix, show that shared prefix and use "is
    // subnetted" (no "variably"). If prefixes differ (e.g. a
    // connected /24 plus its own /32 local route), show the group's
    // classful prefix and use "is variably subnetted" — matches the
    // exact wording distinction confirmed in the real 15.4/17.5
    // captures.
    const distinctPrefixes = Array.from(new Set(entries.map(function (e) { return e.prefix; })));
    let displayPrefix, variably;
    if (distinctPrefixes.length === 1 && entries.every(function (e) { return e.kind === "static" || e.kind === "ospf"; })) {
      displayPrefix = distinctPrefixes[0];
      variably = false;
    } else {
      // Mixed prefixes (or any connected route, which always
      // contributes both its own prefix AND a /32) — use "variably
      // subnetted" with the group's classful prefix length.
      const classfulPrefix = key.endsWith(".0.0.0") ? 8 : key.endsWith(".0.0") ? 16 : 24;
      displayPrefix = classfulPrefix;
      variably = true;
    }
    lines.push(
      "     " + key + "/" + displayPrefix + " is " + (variably ? "variably subnetted" : "subnetted") +
      ", " + subnetCount + " subnets" + (variably ? ", 2 masks" : "")
    );
    // Sort within the group: connected routes first (matches real
    // capture ordering), then static routes, each numerically by
    // network address within their kind.
    entries.sort(function (a, b) {
      if (a.kind !== b.kind) return a.kind === "connected" ? -1 : (b.kind === "connected" ? 1 : 0);
      return ipToInt(a.network) - ipToInt(b.network);
    });
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.kind === "connected") {
        lines.push("C       " + e.network + "/" + e.prefix + " is directly connected, " + e.ifaceName);
        lines.push("L       " + e.ip + "/32 is directly connected, " + e.ifaceName);
      } else if (e.kind === "ospf") {
        lines.push("O       " + e.network + "/" + e.prefix + " [110/" + e.cost + "] via " + e.nextHop + ", 00:00:1" + (i % 10) + ", " + e.ifaceName);
      } else {
        lines.push("S       " + e.network + "/" + e.prefix + " [" + e.adminDistance + "/0] via " + e.nextHop);
      }
    }
  }
  return lines.join("\n");
}

// Format verified against a real router capture ("show interfaces",
// no argument, showing all interfaces in sequence). This renderer
// covers ONE interface (per "show interfaces <name>" — the
// all-interfaces form is not implemented since exercises so far only
// ask for a single named interface). Deliberately a simplified
// subset of real output: hardware address is a plausible generated
// value (not meaningful/decodable), and packet/error counters are
// always zero (a freshly-configured simulated device has no real
// traffic history to report) — the parts that matter for CCNA
// verification purposes (up/down state, IP, MTU/BW, description) are
// accurate; deep packet-counter realism was judged not worth the
// added complexity for a syntax/configuration teaching tool.
function renderShowInterfaceDetail(device, name) {
  const iface = device.interfaces[name];
  const isPhysical = !/^Vlan/i.test(name);
  const up = !iface.shutdown;

  const stateLine = up
    ? name + " is up, line protocol is up (connected)"
    : name + " is administratively down, line protocol is down (disabled)";

  const lines = [stateLine];

  // Subinterfaces get a MUCH shorter, distinct report — verified
  // EXACTLY against a real router capture (v1.35.0): different
  // hardware type string (PQUICC_FEC, not the physical port's chipset
  // string), different default BW/DLY (100000 Kbit / 100 usec, not
  // the physical port's 1000000/10), a completely different
  // encapsulation line ("802.1Q Virtual LAN, Vlan ID <n>" instead of
  // "ARPA"), and NONE of the duplex/keepalive/queueing/packet-counter
  // lines a physical interface shows — real IOS's subinterface report
  // is simply much shorter, not a trimmed variant of the same
  // template.
  if (isSubinterfaceName(name)) {
    const mac = fakeMacForInterface(parentInterfaceName(name));
    lines.push("  Hardware is PQUICC_FEC, address is " + mac + " (bia " + mac + ")");
    if (iface.ip && iface.mask) {
      lines.push("  Internet address is " + iface.ip + "/" + maskToPrefixLength(iface.mask));
    }
    lines.push("  MTU 1500 bytes, BW 100000 Kbit, DLY 100 usec, ");
    lines.push("     reliability 255/255, txload 1/255, rxload 1/255");
    const vlanId = iface.dot1qVlan !== null ? iface.dot1qVlan : 1;
    lines.push("  Encapsulation 802.1Q Virtual LAN, Vlan ID " + vlanId + (iface.dot1qNative ? " (Native)" : ""));
    lines.push("  ARP type: ARPA, ARP Timeout 04:00:00, ");
    lines.push("  Last clearing of \"show interface\" counters never");
    return lines.join("\n");
  }

  // Hardware line: plausible fake MAC, deterministic per interface
  // name so it's stable across multiple show commands in one session
  // (not meant to be decoded/meaningful — a real captured MAC would
  // be device-specific hardware data we can't replicate honestly).
  // Serial interfaces use a different chipset string and have NO MAC
  // address at all — verified against a real capture ("Hardware is
  // HD64570" with nothing following, vs. Ethernet's "Hardware is CN
  // Gigabit Ethernet, address is ...").
  const isSerial = /^Serial/i.test(name);
  let hw;
  if (isSerial) {
    hw = "  Hardware is HD64570";
  } else if (isPhysical) {
    hw = "  Hardware is CN Gigabit Ethernet, address is " + fakeMacForInterface(name) +
         " (bia " + fakeMacForInterface(name) + ")";
  } else {
    hw = "  Hardware is CPU Interface, address is " + fakeMacForInterface(name) +
         " (bia " + fakeMacForInterface(name) + ")";
  }
  lines.push(hw);

  if (iface.description) {
    lines.push("  Description: " + iface.description);
  }
  if (iface.ip && iface.mask) {
    lines.push("  Internet address is " + iface.ip + "/" + maskToPrefixLength(iface.mask));
  }

  const bw = isSerial ? "1544" : "1000000";
  const dly = isSerial ? "20000" : "10";
  lines.push("  MTU 1500 bytes, BW " + bw + " Kbit, DLY " + dly + " usec,");
  lines.push("     reliability 255/255, txload 1/255, rxload 1/255");

  if (isSerial) {
    lines.push("  Encapsulation HDLC, loopback not set, keepalive set (10 sec)");
  } else {
    lines.push("  Encapsulation ARPA, loopback not set");
    lines.push("  Keepalive set (10 sec)");
  }
  if (isPhysical && !isSerial) {
    lines.push("  Full-duplex, 100Mb/s, media type is RJ45");
    lines.push("  output flow-control is unsupported, input flow-control is unsupported");
    lines.push("  ARP type: ARPA, ARP Timeout 04:00:00, ");
  }

  lines.push("  Last input never, output never, output hang never");
  lines.push("  Last clearing of \"show interface\" counters never");
  lines.push("  Input queue: 0/75/0 (size/max/drops); Total output drops: 0");
  lines.push("  Queueing strategy: fifo");
  lines.push("  Output queue :0/40 (size/max)");
  lines.push("  5 minute input rate 0 bits/sec, 0 packets/sec");
  lines.push("  5 minute output rate 0 bits/sec, 0 packets/sec");
  lines.push("     0 packets input, 0 bytes, 0 no buffer");
  lines.push("     Received 0 broadcasts, 0 runts, 0 giants, 0 throttles");
  lines.push("     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored, 0 abort");
  lines.push("     0 packets output, 0 bytes, 0 underruns");
  lines.push("     0 output errors, 0 collisions, 0 interface resets");
  lines.push("     0 unknown protocol drops");

  return lines.join("\n");
}

// Format verified EXACTLY against a real Packet Tracer capture
// (v1.35.0) — a genuinely long report (28 lines), mostly fixed
// boilerplate reflecting default/disabled feature states rather than
// anything this engine tracks as real state. Only the state line,
// addresses, and the conditional "Helper address" line vary based on
// actual configuration; everything else is rendered verbatim from the
// real capture, since none of those settings are configurable in any
// exercise built so far (if a future exercise needs one of them to be
// real state instead of fixed text, this is the function to revisit).
function renderShowIpInterfaceDetail(device, name) {
  const iface = device.interfaces[name];
  const up = !iface.shutdown;
  const stateLine = up
    ? name + " is up, line protocol is up (connected)"
    : name + " is administratively down, line protocol is down (disabled)";

  const lines = [stateLine];
  if (iface.ip && iface.mask) {
    lines.push("  Internet address is " + iface.ip + "/" + maskToPrefixLength(iface.mask));
    lines.push("  Broadcast address is 255.255.255.255");
    lines.push("  Address determined by setup command");
  } else {
    lines.push("  Internet protocol processing disabled");
  }
  lines.push("  MTU is 1500 bytes");
  // Bug found in testing (v1.35.0): this line was previously OMITTED
  // entirely when no helper address was set, but a real capture shows
  // it's always present, explicitly saying "not set" — matching the
  // same "always show the line, state whether it's configured"
  // pattern the ACL lines below use.
  lines.push("  Helper address is " + (iface.helperAddress || "not set"));
  lines.push("  Directed broadcast forwarding is disabled");
  lines.push("  Outgoing access list is " + (iface.outboundAccessList || "not set"));
  lines.push("  Inbound  access list is " + (iface.inboundAccessList || "not set"));
  lines.push("  Proxy ARP is enabled");
  lines.push("  Security level is default");
  lines.push("  Split horizon is enabled");
  lines.push("  ICMP redirects are always sent");
  lines.push("  ICMP unreachables are always sent");
  lines.push("  ICMP mask replies are never sent");
  lines.push("  IP fast switching is disabled");
  lines.push("  IP fast switching on the same interface is disabled");
  lines.push("  IP Flow switching is disabled");
  lines.push("  IP Fast switching turbo vector");
  lines.push("  IP multicast fast switching is disabled");
  lines.push("  IP multicast distributed fast switching is disabled");
  lines.push("  Router Discovery is disabled");
  lines.push("  IP output packet accounting is disabled");
  lines.push("  IP access violation accounting is disabled");
  lines.push("  TCP/IP header compression is disabled");
  lines.push("  RTP/IP header compression is disabled");
  lines.push("  Probe proxy name replies are disabled");
  lines.push("  Policy routing is disabled");
  lines.push("  Network address translation is disabled");
  lines.push("  BGP Policy Mapping is disabled");
  lines.push("  Input features: MCI Check");
  lines.push("  WCCP Redirect outbound is disabled");
  lines.push("  WCCP Redirect inbound is disabled");
  lines.push("  WCCP Redirect exclude is disabled");
  return lines.join("\n");
}

// Generates a plausible, stable (per session) fake MAC address for
// an interface, derived from its name so the same interface always
// shows the same address within one device's lifetime. Not a real
// OUI or meaningful in any way — purely cosmetic realism.
function fakeMacForInterface(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);
  const bytes = [];
  for (let i = 0; i < 3; i++) {
    bytes.push((hash & 0xff).toString(16).padStart(2, "0"));
    hash = Math.floor(hash / 256) || (hash * 7 + 13);
  }
  return "0030.f2" + bytes[0] + "." + bytes[1] + bytes[2];
}

// Format verified EXACTLY against a real router capture:
//   GigabitEthernet0/0         [up/up]
//       FE80::1
//       2001:DB8:1:1::1
//   GigabitEthernet0/2         [administratively down/down]
//       unassigned
// Interface name padded to 27 chars, then "[status/protocol]" — a
// completely different bracketed shape from show ip interface brief's
// column-table format, not a variant of it. Link-local is listed
// before the global address (matching command entry order). An
// interface with no IPv6 configuration at all shows a single
// "unassigned" line, no addresses.
function renderShowIpv6IntBrief(device) {
  const lines = [];
  const names = Object.keys(device.interfaces);
  if (names.length === 0) { return "(no interfaces configured)"; }
  for (let i = 0; i < names.length; i++) {
    const name = names[i], iface = device.interfaces[name];
    const up = !iface.shutdown;
    const statusWord = up ? "up" : "administratively down";
    const protocolWord = up ? "up" : "down";
    lines.push(name.padEnd(27) + "[" + statusWord + "/" + protocolWord + "]");
    if (!iface.ipv6LinkLocal && !iface.ipv6Address) {
      lines.push("    unassigned");
      continue;
    }
    if (iface.ipv6LinkLocal) {
      lines.push("    " + formatIPv6Display(iface.ipv6LinkLocal));
    }
    if (iface.ipv6Address) {
      lines.push("    " + formatIPv6Display(iface.ipv6Address));
    }
  }
  return lines.join("\n");
}

// Format verified against the ground-truth reference lab's expected
// output for 1.1.5. Only meaningfully reports "Enabled" once RSA keys
// have actually been generated (crypto key generate rsa) — matching
// real IOS, where SSH literally doesn't function without keys. The
// timeout/retries/DH key size figures are real IOS defaults, shown
// as fixed values since this engine doesn't model configuring them
// individually (no exercise built so far asks a student to change
// them — if one does in the future, these should become real
// tracked state instead of hardcoded).
function renderShowIpSsh(device) {
  // v1.35.0: timeout/retries now reflect real configured state
  // (ip ssh time-out / ip ssh authentication-retries) instead of
  // hardcoded numbers — this was flagged as a known simplification
  // back when show ip ssh was first built (v1.13.0), anticipating
  // exactly this: a future exercise (1.3) that configures these
  // values individually.
  const timeout = device.sshTimeout !== null ? device.sshTimeout : 120;
  const retries = device.sshAuthRetries !== null ? device.sshAuthRetries : 3;
  if (!device.cryptoKeysGenerated) {
    return "SSH Disabled - version 1.99\n" +
           "Please create RSA keys (of atleast 768 bits size) to enable SSH v1.99 or larger v2\n" +
           "Authentication timeout: " + timeout + " secs; Authentication retries: " + retries;
  }
  const version = device.sshVersion ? device.sshVersion.toFixed(1) : "1.99";
  return "SSH Enabled - version " + version + "\n" +
         "Authentication timeout: " + timeout + " secs; Authentication retries: " + retries + "\n" +
         "Minimum expected Diffie Hellman key size : 1024 bits";
}

// Format verified EXACTLY against a real Packet Tracer capture with
// preserved spacing (v1.35.0) — every label in the top block is
// padded to 32 characters before the colon; the address-range table
// below has "IP address range" starting at column 22 and
// "Leased/Excluded/Total" starting at column 58, both measured
// directly from the real capture, not inferred.
function renderShowIpDhcpPool(device) {
  const poolNames = Object.keys(device.dhcpPools);
  if (poolNames.length === 0) return "";

  // Label width verified EXACTLY against the real capture: colon at
  // column 32 (0-indexed), preceded by a leading space, so the label
  // itself is padded to 31 characters (an earlier build used 32,
  // off by one — corrected here after measuring precisely).
  const labelWidth = 31;
  function row(label, value) {
    return " " + label.padEnd(labelWidth) + ": " + value;
  }

  const lines = [];
  for (let p = 0; p < poolNames.length; p++) {
    const name = poolNames[p];
    const pool = device.dhcpPools[name];
    lines.push("");
    lines.push("Pool " + name + " :");

    let totalAddresses = 0;
    let excludedInPool = 0;
    let firstIp = null, lastIp = null;
    if (pool.network && pool.mask) {
      const netInt = ipToInt(networkAddress(pool.network, pool.mask));
      const prefix = maskToPrefixLength(pool.mask);
      const hostBits = 32 - prefix;
      const blockSize = Math.pow(2, hostBits);
      // Real IOS's "Total addresses" for a /24 pool is 254 (the full
      // block minus network+broadcast, i.e. the usable host range) —
      // confirmed exactly against multiple real captures/community
      // examples. First usable address is network+1.
      totalAddresses = blockSize - 2;
      const firstUsableInt = netInt + 1;
      const lastUsableInt = netInt + blockSize - 2;
      firstIp = intToIp(firstUsableInt);
      lastIp = intToIp(lastUsableInt);

      // Excluded count: a plain raw count of addresses in
      // "ip dhcp excluded-address" ranges that fall within this
      // pool's usable range — confirmed as the general, well-
      // documented behavior via several independent real Cisco
      // examples/community threads (e.g. a 20-address exclusion
      // range correctly showing 20 excluded). One specific capture
      // this project has on hand showed a smaller count than this
      // simple math would predict for its own exact scenario, but
      // that appears to be case-specific rather than the general
      // rule, given how consistently other real sources confirm
      // straightforward raw counting — implemented the well-
      // corroborated general behavior rather than overfit to one
      // ambiguous data point.
      for (let e = 0; e < device.dhcpExcludedRanges.length; e++) {
        const range = device.dhcpExcludedRanges[e];
        const startInt = ipToInt(range.start), endInt = ipToInt(range.end);
        for (let ip = Math.max(startInt, firstUsableInt); ip <= Math.min(endInt, lastUsableInt); ip++) {
          excludedInPool++;
        }
      }
    }

    lines.push(row("Utilization mark (high/low)", "100 / 0"));
    lines.push(row("Subnet size (first/next)", "0 / 0 "));
    lines.push(row("Total addresses", String(totalAddresses)));
    lines.push(row("Leased addresses", "0"));
    lines.push(row("Excluded addresses", String(excludedInPool)));
    lines.push(row("Pending event", "none"));
    lines.push("");
    lines.push(" 1 subnet is currently in the pool");
    lines.push(" Current index        IP address range                    Leased/Excluded/Total");
    if (firstIp && lastIp) {
      // Column positions verified exactly against the real capture:
      // "Current index" value left-padded with 1 leading space, the
      // range column padded so the count column starts at position
      // 58 (0-indexed).
      const idxCol = (" " + firstIp).padEnd(22);
      const rangeCol = (firstIp + "     - " + lastIp).padEnd(37);
      const countCol = "0    / " + excludedInPool + "     / " + totalAddresses;
      lines.push(idxCol + rangeCol + countCol);
    }
  }
  return lines.join("\n").replace(/^\n/, "");
}

// Real IOS abbreviates interface names in "show vlan brief" port
// lists specifically — verified against a real Packet Tracer capture
// showing "Fa0/1" and "Gig0/1", a DIFFERENT abbreviation style than
// anywhere else in this engine (every other show command uses full
// names like "GigabitEthernet0/1"). Scoped narrowly to this one
// renderer rather than applied generally, since it's confirmed
// specific to this command's real output.
function shortInterfaceName(name) {
  return name
    .replace(/^GigabitEthernet/i, "Gig")
    .replace(/^FastEthernet/i, "Fa")
    .replace(/^Serial/i, "Se")
    .replace(/^Loopback/i, "Lo");
}

/* ---------------------------------------------------------
   OSPF — network/wildcard matching, simulated neighbor, and the
   three real show-command renderers verified against a real router
   capture (v1.35.0): show ip ospf neighbor, show ip protocol,
   show ip ospf interface <name>. Also feeds the "O"/"O*E2" route
   codes in show ip route (see renderShowIpRoute).

   Neighbor simulation: this engine has no second real device to form
   a genuine adjacency with, so — consistent with this project's
   established approach for DHCP pools, port security, etc. — a
   PLAUSIBLE single simulated neighbor is shown once an interface is
   genuinely enabled for OSPF (a configured, up interface whose IP
   falls within one of the router's own "network" statements). This
   isn't a real routing simulation; it's confirming the CONFIGURATION
   is one that would plausibly succeed in real IOS, matching this
   project's whole teaching philosophy.
   --------------------------------------------------------- */

// Returns true if the given IP falls within network/wildcard (an
// OSPF-style wildcard mask, where a 1 bit means "don't care" — the
// inverse of a normal subnet mask).
function ipMatchesWildcard(ip, network, wildcard) {
  const ipInt = ipToInt(ip), netInt = ipToInt(network), wcInt = ipToInt(wildcard);
  return (ipInt & ~wcInt) >>> 0 === (netInt & ~wcInt) >>> 0;
}

// Returns the list of {name, iface} pairs for interfaces that are
// genuinely OSPF-enabled: configured with an IP, up, and matching one
// of the router's own "network area" statements.
function getOspfEnabledInterfaces(device) {
  if (!device.ospf) return [];
  const result = [];
  const names = Object.keys(device.interfaces);
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const iface = device.interfaces[name];
    if (!iface.ip || !iface.mask || iface.shutdown) continue;
    for (let n = 0; n < device.ospf.networks.length; n++) {
      const net = device.ospf.networks[n];
      if (ipMatchesWildcard(iface.ip, net.network, net.wildcard)) {
        result.push({ name: name, iface: iface, area: net.area });
        break;
      }
    }
  }
  return result;
}

// Real IOS auto-selects a router ID from the highest configured
// loopback address, or if none, the highest IP among up physical
// interfaces — verified against real captures showing router IDs
// that match a configured interface exactly when "router-id" was
// never explicitly set.
function getOspfRouterId(device) {
  if (device.ospf.routerId) return device.ospf.routerId;
  const enabled = getOspfEnabledInterfaces(device);
  if (enabled.length === 0) return "0.0.0.0";
  let highest = enabled[0].iface.ip;
  for (let i = 1; i < enabled.length; i++) {
    if (ipToInt(enabled[i].iface.ip) > ipToInt(highest)) highest = enabled[i].iface.ip;
  }
  return highest;
}

// Deterministic (not random) simulated neighbor per OSPF-enabled,
// non-passive interface — derived from the interface's own IP so it
// stays STABLE across repeated show commands in one session, rather
// than a new random neighbor appearing every time. Point-to-point
// (Serial) interfaces get "FULL/  -" (no DR/BDR concept, matching the
// real capture exactly); broadcast (Ethernet) interfaces get a real
// DR/BDR state based on this router's own configured priority versus
// a simulated neighbor's assumed default priority of 1.
function getSimulatedOspfNeighbor(device, name, iface) {
  const isPointToPoint = /^Serial/i.test(name);
  const ipParts = iface.ip.split(".").map(Number);
  const neighborId = [(ipParts[0] + 1) % 256, (ipParts[1] + 1) % 256, (ipParts[2] + 1) % 256, (ipParts[3] + 2) % 256].join(".");
  const neighborIp = iface.ip.split(".").slice(0, 3).join(".") + "." + ((ipParts[3] + 1) % 256);
  let state;
  if (isPointToPoint) {
    // Point-to-point has no DR/BDR concept at all — verified EXACTLY
    // against a real Packet Tracer capture ("FULL/  -" with TWO
    // spaces before the dash). The ground-truth reference text for
    // this exercise showed only one space, but a real capture is a
    // more trustworthy source than reference-tool text, so the
    // two-space form (already directly verified) is kept.
    state = "FULL/  -";
  } else {
    // Multiaccess DR/BDR: verified against real ground-truth data.
    // If THIS router's own priority is explicitly raised above the
    // simulated neighbor's assumed default (1), this router becomes
    // DR and the shown neighbor is correctly listed as BDR (the
    // neighbor TABLE shows the OTHER router's role, not our own —
    // confirmed by the real example showing "2.2.2.2 ... FULL/DR"
    // where 2.2.2.2 is a neighbor, so that neighbor is itself the DR
    // in that specific scenario). If our own priority is 0, we can
    // never be DR/BDR, so the neighbor becomes DR by default instead.
    if (iface.ospfPriority === 0) state = "FULL/DR ";
    else if (iface.ospfPriority > 1) state = "FULL/BDR";
    else state = "FULL/DR "; // default priority (1) on both sides -- plausible baseline scenario
  }
  return { neighborId: neighborId, neighborIp: neighborIp, priority: isPointToPoint ? 0 : 1, state: state };
}

// Format verified EXACTLY against a real router capture (v1.35.0) —
// column positions measured directly against the header row: State
// starts at column 22, Dead Time at 38, Address at 50, Interface at
// 66 (0-indexed). The Neighbor ID field itself is NOT a fixed width
// before Pri — Pri's value sits at a fixed offset from the ID's own
// end, matching how real IOS right-pads based on the ID's length.
function renderShowIpOspfNeighbor(device) {
  const enabled = getOspfEnabledInterfaces(device).filter(function (e) {
    return device.ospf.passiveInterfaces.indexOf(e.name) === -1;
  });
  const lines = ["", "Neighbor ID     Pri   State           Dead Time   Address         Interface"];
  for (let i = 0; i < enabled.length; i++) {
    const n = getSimulatedOspfNeighbor(device, enabled[i].name, enabled[i].iface);
    // Absolute column positions (0-indexed), measured directly
    // against the real capture's header row: Pri digit at column 18,
    // State at 22, Dead Time at 38, Address at 50, Interface at 66 —
    // using absolute positions (not fixed spacing after the ID)
    // keeps this correct even for longer neighbor IDs.
    let row = n.neighborId.padEnd(18) + n.priority;
    row = row.padEnd(22) + n.state;
    row = row.padEnd(38) + ("00:00:3" + (i % 10));
    row = row.padEnd(50) + n.neighborIp;
    row = row.padEnd(66) + shortInterfaceNameForOspf(enabled[i].name);
    lines.push(row);
  }
  return lines.join("\n");
}
// OSPF neighbor/interface tables use FULL interface names (verified
// against the real capture: "Serial0/0/0", not "Se0/0/0") — different
// convention from show vlan brief's abbreviated ports, so this is
// deliberately a separate helper from shortInterfaceName() rather
// than reusing it.
function shortInterfaceNameForOspf(name) { return name; }

/* ---------------------------------------------------------
   ACCESS LISTS — verified EXACTLY against a real Packet Tracer
   capture (v1.35.0).
   --------------------------------------------------------- */

// Real IOS displays a handful of well-known ports by NAME instead of
// number in ACL output — confirmed via a real capture: port 80
// becomes "www", port 21 becomes "ftp". Port 443 (HTTPS) stayed as
// "443" in that SAME real capture — confirming not every well-known
// port gets a name, only ones IOS has a built-in name for. This list
// reflects only names directly confirmed or extremely well-documented
// as real IOS port-name mappings; anything not listed (including 443)
// displays as its plain number, matching the real capture exactly.
const ACL_PORT_NAMES = { 20: "ftp-data", 21: "ftp", 23: "telnet", 25: "smtp", 53: "domain", 69: "tftp", 80: "www", 110: "pop3" };

function formatAclPort(port) {
  const num = Number(port);
  return ACL_PORT_NAMES[num] || String(port);
}

// Renders one ACL entry in the canonical form real IOS displays it in
// (which can differ from how it was typed) — verified EXACTLY against
// two independent real captures. Standard: a host entry becomes
// "permit host <ip>"; a network entry becomes "permit <network>
// <wildcard>" with NO "wildcard bits" phrase. Extended: source/dest
// each render as "any", "host <ip>", or "<network> <wildcard>"
// depending on how they were typed; a port match renders as "eq
// <port-name-or-number>"; "established" renders as its own trailing
// keyword with no port at all.
function renderAclEntry(entry) {
  if (entry.type === "extended") {
    const parts = [entry.action, entry.protocol];
    parts.push(renderAclAddress(entry.src));
    parts.push(renderAclAddress(entry.dst));
    if (entry.port) parts.push("eq " + formatAclPort(entry.port));
    if (entry.established) parts.push("established");
    return parts.join(" ");
  }
  if (entry.matchType === "host") {
    return entry.action + " host " + entry.host;
  }
  return entry.action + " " + entry.network + " " + entry.wildcard;
}

// Renders one source/destination address spec for an extended ACL
// entry: "any", "host <ip>", or "<network> <wildcard>".
function renderAclAddress(addr) {
  if (addr.kind === "any") return "any";
  if (addr.kind === "host") return "host " + addr.ip;
  return addr.network + " " + addr.wildcard;
}

function renderShowAccessLists(device) {
  const names = Object.keys(device.accessLists);
  if (names.length === 0) return "";
  const lines = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const acl = device.accessLists[name];
    const typeLabel = acl.type === "standard" ? "Standard IP access list " + name : "Extended IP access list " + name;
    lines.push(typeLabel);
    for (let e = 0; e < acl.entries.length; e++) {
      // Real IOS auto-numbers entries 10, 20, 30... in the order
      // they're added — confirmed exactly against the real capture.
      lines.push("    " + ((e + 1) * 10) + " " + renderAclEntry(acl.entries[e]));
    }
    // Bug found in testing (v1.35.0): a real capture showing FOUR
    // consecutive ACLs confirmed there is NO blank line between
    // them at all — an earlier version of this function inserted one
    // based on an assumption never actually verified against a
    // multi-ACL capture.
  }
  return lines.join("\n");
}

/* ---------------------------------------------------------
   NAT — verified EXACTLY against a real router capture (v1.35.0)
   for static NAT, and against the ground-truth reference script for
   dynamic NAT / PAT (both variants).

   Simulated translation entries: static NAT entries always show in
   "show ip nat translations" immediately, confirmed via the real
   capture (no traffic needed to trigger it). Dynamic NAT and PAT
   entries only appear once traffic actually flows — confirmed via
   the ground-truth reference showing "show ip nat statistics" with
   ZERO active translations even after Dynamic NAT is fully
   configured. PAT using a single interface's address is the one
   case where the reference script's own sample output DOES show
   populated translation entries (implying Packet Tracer's own
   simulated traffic in that specific lab) — modeled here as one
   plausible simulated entry, consistent with this project's existing
   approach to "no second real device" scenarios (OSPF neighbors,
   DHCP, etc.), specifically for interface-based PAT only.
   --------------------------------------------------------- */

function renderShowIpNatTranslations(device) {
  const lines = ["Pro  Inside global     Inside local       Outside local      Outside global"];
  for (let i = 0; i < device.natStaticRules.length; i++) {
    const r = device.natStaticRules[i];
    lines.push("---  " + r.globalIp.padEnd(18) + r.localIp.padEnd(19) + "---".padEnd(19) + "---");
  }
  // Simulated PAT-via-interface entries — only for rules using a
  // single interface's own address (not a pool), matching the one
  // real scenario the ground-truth reference shows as populated.
  for (let i = 0; i < device.natDynamicRules.length; i++) {
    const rule = device.natDynamicRules[i];
    if (!rule.interfaceName || !rule.overload) continue;
    const iface = device.interfaces[rule.interfaceName];
    if (!iface || !iface.ip) continue;
    // Deterministic simulated inside-local address and port, derived
    // from the interface's own IP so it's stable across repeated
    // show commands rather than randomly changing each time.
    const parts = iface.ip.split(".").map(Number);
    const simulatedLocal = "192.168.10." + (10 + (parts[3] % 5));
    const port = 1034 + (parts[3] % 5);
    // Bug found in testing (v1.35.0): the first field's padEnd width
    // was too narrow for a real value (IP:port can be 21+ characters
    // on its own), producing zero separation before the next column.
    // Fixed using exact widths measured against the ground-truth
    // reference's sample row: inside-global field 23 chars (after
    // the "tcp  " prefix), inside-local field 18, outside-local
    // field 17, outside-global unpadded.
    lines.push("tcp  " + (iface.ip + ":" + port).padEnd(23) + (simulatedLocal + ":").padEnd(18) + "8.8.8.8:53".padEnd(17) + "8.8.8.8:53");
  }
  return lines.join("\n");
}

function renderShowIpNatStatistics(device) {
  const staticCount = device.natStaticRules.length;
  // "Total translations" counts ACTIVE translations, not configured
  // RULES — confirmed via a real discrepancy caught in testing
  // (v1.35.0): a real capture showed "Total translations: 2" for two
  // STATIC entries (always active immediately), while the
  // ground-truth reference showed "Total active translations: 0" for
  // a fully-configured DYNAMIC NAT rule with no simulated traffic —
  // both are correct real IOS behavior for their respective
  // scenarios, they're just measuring different things. Dynamic
  // (pool-based, non-overload) rules never count here unless traffic
  // is simulated (this project doesn't simulate dynamic NAT traffic,
  // only interface-based PAT — see renderShowIpNatTranslations).
  const dynamicCount = 0;
  const extendedCount = device.natDynamicRules.filter(function (r) {
    return r.overload && r.interfaceName && device.interfaces[r.interfaceName] && device.interfaces[r.interfaceName].ip;
  }).length;
  const total = staticCount + dynamicCount + extendedCount;

  const insideIfaces = [], outsideIfaces = [];
  const names = Object.keys(device.interfaces);
  for (let i = 0; i < names.length; i++) {
    const iface = device.interfaces[names[i]];
    if (iface.natRole === "inside") insideIfaces.push(names[i]);
    else if (iface.natRole === "outside") outsideIfaces.push(names[i]);
  }

  const lines = [
    "Total translations: " + total + " (" + staticCount + " static, " + dynamicCount + " dynamic, " + extendedCount + " extended)",
    "Outside Interfaces: " + (outsideIfaces.length > 0 ? outsideIfaces.join(" , ") : "none"),
    "Inside Interfaces: " + (insideIfaces.length > 0 ? insideIfaces.join(" , ") : "none"),
    "Hits: 0  Misses: 0",
    "Expired translations: 0",
    "Dynamic mappings:"
  ];
  for (let i = 0; i < device.natDynamicRules.length; i++) {
    const rule = device.natDynamicRules[i];
    if (rule.poolName && device.natPools[rule.poolName]) {
      const pool = device.natPools[rule.poolName];
      const startInt = ipToInt(pool.start), endInt = ipToInt(pool.end);
      const totalAddresses = endInt - startInt + 1;
      lines.push("-- Inside Source");
      lines.push("[Id: " + (i + 1) + "] access-list " + rule.aclNumber + " pool " + rule.poolName + (rule.overload ? " refcount 0" : " refcount 0"));
      lines.push(" pool " + rule.poolName + ": netmask " + pool.netmask);
      lines.push("        start " + pool.start + " end " + pool.end);
      lines.push("        total addresses " + totalAddresses + ", allocated 0 (0%), misses 0");
    } else if (rule.interfaceName) {
      lines.push("-- Inside Source");
      lines.push("[Id: " + (i + 1) + "] access-list " + rule.aclNumber + " interface " + rule.interfaceName + " refcount 0");
    }
  }
  return lines.join("\n");
}

/* ---------------------------------------------------------
   CDP / LLDP — verified EXACTLY against two real router captures
   (v1.35.0): one showing the correct EMPTY-table format (a fresh,
   disconnected router), and a second showing a REAL populated
   neighbor table after physically connecting two routers and
   bringing the link up — giving real column positions for both the
   empty and populated cases, and confirming CDP and LLDP use
   DIFFERENT interface abbreviation conventions from each other
   ("Gig 0/0/0" with a space for CDP; "Gig0/0/0" no space for LLDP —
   also different again from show vlan brief's "Gig0/1" style).

   Simulated neighbor: consistent with this project's established
   "no second real device" approach (OSPF, DHCP, etc.) — shown once
   CDP/LLDP is genuinely enabled AND the interface is up. Modeled as
   a generic switch (matching the ORIGINAL ground-truth reference's
   own sample: "S1", "WS-C2960"), not literally named after whatever
   device was used during real-capture testing, since a switch is
   more representative of a typical CCNA lab scenario than another
   router.
   --------------------------------------------------------- */

function getCdpLldpEnabledInterfaces(device, requireLldpFlags) {
  const result = [];
  const names = Object.keys(device.interfaces);
  for (let i = 0; i < names.length; i++) {
    const iface = device.interfaces[names[i]];
    if (iface.shutdown) continue;
    if (requireLldpFlags && !(iface.lldpTransmit && iface.lldpReceive)) continue;
    result.push({ name: names[i], iface: iface });
  }
  return result;
}

function renderShowCdpNeighbors(device) {
  const lines = [
    "Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge",
    "                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone",
    "Device ID    Local Intrfce   Holdtme    Capability   Platform    Port ID"
  ];
  if (!device.cdpEnabled) return lines.join("\n");
  const enabled = getCdpLldpEnabledInterfaces(device, false);
  for (let i = 0; i < enabled.length; i++) {
    // CDP interface abbreviation confirmed via real capture: "Gig
    // 0/0/0" — a SPACE between type and slot, unlike LLDP's own
    // abbreviation for the same interface.
    const localAbbrev = enabled[i].name.replace(/^GigabitEthernet/i, "Gig ").replace(/^FastEthernet/i, "Fas ").replace(/^Serial/i, "Ser ");
    lines.push(
      "S1".padEnd(13) + localAbbrev.padEnd(17) + "144".padEnd(11) + "S".padEnd(13) + "WS-C2960".padEnd(12) + localAbbrev.replace(/^\S+\s/, "Fas ")
    );
  }
  return lines.join("\n");
}

function renderShowLldpNeighbors(device) {
  const lines = [
    "Capability codes:",
    "    (R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device",
    "    (W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other",
    "Device ID           Local Intf     Hold-time  Capability      Port ID"
  ];
  if (!device.lldpEnabled) {
    lines.push("", "Total entries displayed: 0");
    return lines.join("\n");
  }
  // LLDP additionally requires BOTH transmit and receive on the local
  // interface — confirmed by real IOS logic (LLDP is directional,
  // unlike CDP, which has no separate transmit/receive toggle).
  const enabled = getCdpLldpEnabledInterfaces(device, true);
  if (enabled.length === 0) {
    lines.push("", "Total entries displayed: 0");
    return lines.join("\n");
  }
  for (let i = 0; i < enabled.length; i++) {
    // LLDP interface abbreviation confirmed via real capture:
    // "Gig0/0/0" — NO space, unlike CDP's own abbreviation for the
    // exact same interface.
    const localAbbrev = enabled[i].name.replace(/^GigabitEthernet/i, "Gig").replace(/^FastEthernet/i, "Fas").replace(/^Serial/i, "Ser");
    lines.push("S1".padEnd(20) + localAbbrev.padEnd(15) + "120".padEnd(11) + "B".padEnd(16) + localAbbrev.replace(/^\S+/, "Fas0/5"));
  }
  lines.push("", "Total entries displayed: " + enabled.length);
  return lines.join("\n");
}

/* ---------------------------------------------------------
   NTP — built from the ground-truth reference's real sample output
   (real capture not obtained for this pair, but the reference data's
   own sample output is detailed and specific enough to trust
   directly, including exact stratum-1 field values).
   --------------------------------------------------------- */

function renderShowNtpStatus(device) {
  if (device.ntpMasterStratum !== null) {
    return [
      "Clock is synchronized, stratum " + device.ntpMasterStratum + ", reference is .LOCL.",
      "nominal freq is 250.0000 Hz, actual freq is 250.0000 Hz, precision is 2**10",
      "ntpuptime is 0 (sec), resolution is 4000"
    ].join("\n");
  }
  if (device.ntpServer) {
    return [
      "Clock is synchronized, stratum 2, reference is " + device.ntpServer,
      "nominal freq is 250.0000 Hz, actual freq is 250.0000 Hz, precision is 2**10",
      "ntpuptime is 0 (sec), resolution is 4000"
    ].join("\n");
  }
  return "Clock is unsynchronized, stratum 16, no reference clock";
}

function renderShowNtpAssociations(device) {
  const lines = ["  address         ref clock       st  when  poll reach  delay  offset   disp"];
  if (device.ntpServer) {
    lines.push("*~" + device.ntpServer.padEnd(16) + ".LOCL.".padEnd(16) + "1    10    64   377    1.00    0.000   0.12");
    lines.push(" * sys.peer, # selected, + candidate, - outlyer, x falseticker");
  }
  return lines.join("\n");
}

/* ---------------------------------------------------------
   SNMP / SYSLOG — built from this project's ground-truth reference
   data's own detailed sample output. UNLIKE most other commands in
   this project, this pair was NOT verified against a real Packet
   Tracer capture — no direct-match capture lab exists for SNMP or
   Syslog configuration specifically in this curriculum (checked;
   only a large skills-integration challenge combines them with many
   other topics). The reference data itself is unusually detailed and
   specific (real-looking field names and structure), so it was
   trusted directly, consistent with how strong reference data has
   been handled elsewhere in this project (e.g. NTP) — but this
   should be revisited if a real capture ever becomes available.
   --------------------------------------------------------- */

function renderShowSnmpCommunity(device) {
  const lines = [];
  for (let i = 0; i < device.snmpCommunities.length; i++) {
    const c = device.snmpCommunities[i];
    if (i > 0) lines.push("");
    lines.push("Community name: " + c.string);
    lines.push("Community Index: " + c.string);
    lines.push("Security Name: " + c.string);
    lines.push("storage-type: nonvolatile    active");
  }
  return lines.join("\n");
}

function renderShowLogging(device) {
  const lines = [
    "Syslog logging: enabled (0 messages dropped, 0 flushes, 0 overruns)",
    "    Console logging: level debugging, 28 messages logged",
    "    Monitor logging: level debugging, 0 messages logged",
    "    Buffer logging:  level debugging, 28 messages logged",
    "    Logging Exception size (4096 bytes)"
  ];
  if (device.loggingHost) {
    const level = device.loggingTrapLevel || "debugging";
    lines.push("    Trap logging: level " + level + ", 30 message lines logged");
    lines.push("        Logging to " + device.loggingHost + "  (udp port 514, audit disabled,");
    lines.push("              link up), 30 message lines logged");
  }
  lines.push("Log Buffer (4096 bytes):");
  return lines.join("\n");
}

// Format verified EXACTLY against a real router capture (v1.35.0).
// Note the real command is singular "protocol", not "protocols".
// Format verified against the real ground-truth reference for "show
// ip ospf" (process summary — distinct from "show ip protocol").
function renderShowIpOspf(device) {
  if (!device.ospf) return "";
  const areas = new Set(device.ospf.networks.map(function (n) { return n.area; }));
  return [
    "Routing Process \"ospf " + device.ospf.processId + "\" with ID " + getOspfRouterId(device),
    " Start time: 00:01:00.000, Time elapsed: 00:05:00.000",
    " Supports only single TOS(TOS0) routes",
    " Number of areas in this router is " + areas.size + ". " + areas.size + " normal 0 stub 0 nssa"
  ].join("\n");
}

function renderShowIpProtocol(device) {
  if (!device.ospf) return "";
  const enabled = getOspfEnabledInterfaces(device);
  const lines = [
    "", "Routing Protocol is \"ospf " + device.ospf.processId + "\"",
    "  Outgoing update filter list for all interfaces is not set ",
    "  Incoming update filter list for all interfaces is not set ",
    "  Router ID " + getOspfRouterId(device),
    "  Number of areas in this router is " + new Set(device.ospf.networks.map(function (n) { return n.area; })).size + ". 1 normal 0 stub 0 nssa",
    "  Maximum path: 4",
    "  Routing for Networks:"
  ];
  for (let i = 0; i < device.ospf.networks.length; i++) {
    const n = device.ospf.networks[i];
    lines.push("    " + n.network + " " + n.wildcard + " area " + n.area);
  }
  if (device.ospf.passiveInterfaces.length > 0) {
    lines.push("  Passive Interface(s): ");
    for (let i = 0; i < device.ospf.passiveInterfaces.length; i++) {
      lines.push("    " + device.ospf.passiveInterfaces[i]);
    }
  }
  lines.push("  Routing Information Sources:  ");
  lines.push("    Gateway         Distance      Last Update ");
  const routerId = getOspfRouterId(device);
  lines.push("    " + routerId.padEnd(21) + "110      00:00:01");
  for (let i = 0; i < enabled.length; i++) {
    const n = getSimulatedOspfNeighbor(device, enabled[i].name, enabled[i].iface);
    lines.push("    " + n.neighborId.padEnd(21) + "110      00:00:01");
  }
  lines.push("  Distance: (default is 110)");
  return lines.join("\n");
}

// Format verified against real IOS conventions for this command
// (cost formula, hello/dead timer display) — the specific real
// capture on hand for this project used a router model whose 2-
// segment interface naming didn't match the name being queried, so
// exact spacing for a SUCCESSFUL query wasn't directly confirmed;
// built from the well-documented general format instead. Worth
// re-verifying against a real capture if one becomes available.
function renderShowIpOspfInterface(device, name) {
  if (!device.ospf) {
    return shortInterfaceName(name) + " is up, line protocol is up\n  OSPF not enabled on this interface";
  }
  const iface = device.interfaces[name];
  const matched = getOspfEnabledInterfaces(device).find(function (e) { return e.name === name; });
  if (!matched) {
    return shortInterfaceName(name) + " is up, line protocol is up\n  OSPF not enabled on this interface";
  }
  const isPassive = device.ospf.passiveInterfaces.indexOf(name) !== -1;
  const isPointToPoint = /^Serial/i.test(name);
  const bw = isPointToPoint ? 1544 : 1000000;
  const cost = Math.max(1, Math.floor((device.ospf.referenceBandwidth * 1000) / bw));
  const routerId = getOspfRouterId(device);
  // Real format, verified against ground-truth reference data for
  // both point-to-point (2.6) and multiaccess/DR-BDR (2.3) scenarios:
  // point-to-point never shows a State/DR line at all (no DR/BDR
  // concept); multiaccess shows "State DR"/"State BDR"/"State DROTHER"
  // plus a "Designated Router (ID)" line, based on this router's own
  // simulated election outcome (see getSimulatedOspfNeighbor's DR/BDR
  // logic — kept consistent between the two commands).
  const lines = [
    name + " is up, line protocol is up",
    "  Internet Address " + iface.ip + "/" + maskToPrefixLength(iface.mask) + ", Area " + matched.area + (isPointToPoint ? "" : ", Attached via Network Statement"),
    "  Network Type " + (isPointToPoint ? "POINT_TO_POINT" : "BROADCAST") + ", Cost: " + cost
  ];
  if (isPointToPoint) {
    lines.push("  Timer intervals configured, Hello " + iface.ospfHelloInterval + ", Dead " + iface.ospfDeadInterval + ", Wait " + iface.ospfDeadInterval + ", Retransmit 5");
  } else {
    const ownState = iface.ospfPriority === 0 ? "DROTHER" : (iface.ospfPriority > 1 ? "DR" : "DROTHER");
    lines.push("  Transmit Delay is 1 sec, State " + ownState + ", Priority " + iface.ospfPriority);
    if (ownState === "DR") {
      lines.push("  Designated Router (ID) " + routerId + ", Interface address " + iface.ip);
    }
    lines.push("  Timer intervals configured, Hello " + iface.ospfHelloInterval + ", Dead " + iface.ospfDeadInterval + ", Wait " + iface.ospfDeadInterval + ", Retransmit 5");
  }
  if (iface.ospfMd5AuthEnabled) lines.push("  Message digest authentication enabled");
  return lines.join("\n");
}

// Column widths verified EXACTLY against a real Packet Tracer capture
// (v1.35.0) — the person counted the dash-separator line character by
// character: VLAN=4, Name=32, Status=9, Ports=31, single space between
// columns (not the multi-space-padding style used elsewhere). Also
// confirmed via the same capture: real switches carry 5 default VLANs
// from boot (1, 1002-1005 — see freshVlanTable()), and the Ports
// column wraps onto continuation lines (aligned under the Ports
// column start) when a VLAN has many access ports, roughly 4 ports
// per line in the real capture.
function renderShowVlanBrief(device) {
  const widths = [4, 32, 9, 31];
  function padCol(text, width) { return String(text).padEnd(width); }

  const lines = [];
  lines.push(padCol("VLAN", widths[0]) + " " + padCol("Name", widths[1]) + " " + padCol("Status", widths[2]) + " " + "Ports");
  lines.push("-".repeat(widths[0]) + " " + "-".repeat(widths[1]) + " " + "-".repeat(widths[2]) + " " + "-".repeat(widths[3]));

  // Collect access ports per VLAN (only access-mode ports count —
  // trunk ports don't appear in this listing, matching real IOS).
  const portsByVlan = {};
  const ifNames = Object.keys(device.interfaces);
  for (let i = 0; i < ifNames.length; i++) {
    const iface = device.interfaces[ifNames[i]];
    if (iface.switchportMode === "access" && iface.accessVlan !== null) {
      if (!portsByVlan[iface.accessVlan]) portsByVlan[iface.accessVlan] = [];
      portsByVlan[iface.accessVlan].push(shortInterfaceName(ifNames[i]));
    }
  }

  const vlanIds = Object.keys(device.vlans).map(Number).sort(function (a, b) { return a - b; });
  const portsPerLine = 4; // matches the real capture's wrapping

  for (let v = 0; v < vlanIds.length; v++) {
    const id = vlanIds[v];
    const vlan = device.vlans[id];
    const ports = portsByVlan[id] || [];

    const prefix = padCol(id, widths[0]) + " " + padCol(vlan.name, widths[1]) + " " + padCol(vlan.status, widths[2]) + " ";

    if (ports.length === 0) {
      // Real IOS does NOT trim trailing whitespace here — verified
      // against a real capture showing "1002 fddi-default    active    "
      // with trailing spaces after "active" (the Ports column's
      // leading space, un-trimmed even though no ports follow).
      lines.push(prefix);
      continue;
    }

    // First line carries the prefix; continuation lines are just
    // blank-padded to the same indentation as the Ports column start.
    const indent = " ".repeat(prefix.length);
    for (let p = 0; p < ports.length; p += portsPerLine) {
      const chunk = ports.slice(p, p + portsPerLine).join(", ");
      lines.push((p === 0 ? prefix : indent) + chunk);
    }
  }

  return lines.join("\n");
}

// Format verified against the ground-truth reference lab's expected
// output for 3.3.12. Three sub-sections, each with its own mini
// header row, matching real IOS's actual "show interfaces ... trunk"
// structure.
function renderShowInterfacesTrunk(device, name) {
  const iface = device.interfaces[name];
  const shortName = shortInterfaceName(name);

  if (iface.switchportMode !== "trunk") {
    // Real IOS prints nothing meaningful for a non-trunk port with
    // this command — closest real behavior is simply an empty report.
    return "";
  }

  const nativeVlan = iface.trunkNativeVlan !== null ? iface.trunkNativeVlan : 1;
  const allowedVlans = iface.trunkAllowedVlans !== null ? iface.trunkAllowedVlans.join(",") : "1-4094";

  const lines = [];
  lines.push("Port      Mode         Encapsulation  Status        Native vlan");
  lines.push(shortName.padEnd(10) + "on".padEnd(13) + "802.1q".padEnd(15) + "trunking".padEnd(14) + nativeVlan);
  lines.push("");
  lines.push("Port      Vlans allowed on trunk");
  lines.push(shortName.padEnd(10) + allowedVlans);
  lines.push("");
  lines.push("Port      Vlans in spanning tree forwarding state and not pruned");
  lines.push(shortName.padEnd(10) + allowedVlans);
  return lines.join("\n");
}

// Format verified EXACTLY against a real Packet Tracer capture with
// preserved spacing (v1.35.0) — the person confirmed the terminal
// uses Courier (monospace), so column positions in the raw text are
// the real positions. The earlier v1.18.0 build inferred a width of
// 28 based on the longest label + a standard 2-space gap; the real
// capture confirmed 27 (labels padded to 27 characters before the
// colon, matching every row measured, including "Last Source
// Address:Vlan" — which has its own embedded colon, so the padding
// check has to find the SECOND colon, the real field delimiter).
function renderShowPortSecurityInterface(device, name) {
  const iface = device.interfaces[name];
  const labelWidth = 27; // verified exactly against a real spacing-preserved capture

  function row(label, value) {
    return label.padEnd(labelWidth) + ": " + value;
  }

  const enabled = iface.portSecurityEnabled;
  const up = !iface.shutdown;
  const portStatus = enabled ? (up ? "Secure-up" : "Secure-down") : (up ? "Up" : "Down");
  const violationMode = iface.portSecurityViolation.charAt(0).toUpperCase() + iface.portSecurityViolation.slice(1);
  const stickyCount = iface.portSecurityStickyMacs.length;
  // Total MAC addresses learned/configured — this engine doesn't
  // simulate real traffic-based MAC learning, so "total" reflects
  // only explicitly-configured sticky MACs (via "switchport
  // port-security mac-address sticky <mac>"), not addresses that
  // would be learned from real frames on real hardware.
  const totalMacs = stickyCount;
  const lastMac = stickyCount > 0 ? iface.portSecurityStickyMacs[stickyCount - 1] : "0000.0000.0000";
  const lastVlan = stickyCount > 0 ? (iface.accessVlan !== null ? iface.accessVlan : 1) : 0;

  const lines = [];
  lines.push(row("Port Security", enabled ? "Enabled" : "Disabled"));
  lines.push(row("Port Status", portStatus));
  lines.push(row("Violation Mode", violationMode));
  lines.push(row("Aging Time", "0 mins"));
  lines.push(row("Aging Type", "Absolute"));
  lines.push(row("SecureStatic Address Aging", "Disabled"));
  lines.push(row("Maximum MAC Addresses", String(iface.portSecurityMax)));
  lines.push(row("Total MAC Addresses", String(totalMacs)));
  lines.push(row("Configured MAC Addresses", "0"));
  lines.push(row("Sticky MAC Addresses", String(stickyCount)));
  lines.push(row("Last Source Address:Vlan", lastMac + ":" + lastVlan));
  lines.push(row("Security Violation Count", "0"));
  return lines.join("\n");
}

// Simulated single fixed "neighbor" device for ping testing, matching
// the addressing-table pattern used in NetAcad's own 2.7.6 Packet
// Tracer lab (a switch's VLAN1 SVI pinging a neighboring switch's
// VLAN1 SVI on the same subnet). This is intentionally Packet-Tracer
// -style behavior (config-state-dependent simulated result), NOT
// what the real text-based NetAcad Syntax Checker does (which would
// just accept correctly-typed "ping <ip>" regardless of state) — a
// deliberate choice per this version's design discussion, going
// beyond Syntax Checker fidelity toward Packet Tracer fidelity.
const SIMULATED_NEIGHBOR_IP = "192.168.1.1";

// Finds the interface currently providing IP connectivity for ping
// purposes. For a switch, that's the VLAN1 SVI; this looks for any
// configured, non-shutdown interface with an IP address, which also
// naturally supports router-style interfaces later without change.
function findActiveIpInterface(device) {
  const names = Object.keys(device.interfaces);
  for (let i = 0; i < names.length; i++) {
    const iface = device.interfaces[names[i]];
    if (iface.ip && iface.mask && !iface.shutdown) {
      return { name: names[i], iface: iface };
    }
  }
  return null;
}

function renderPing(device, target) {
  const active = findActiveIpInterface(device);
  const timeoutOutput =
    "Sending 5, 100-byte ICMP Echos to " + target + ", timeout is 2 seconds:\n" +
    ".....\n" +
    "Success rate is 0 percent (0/5)";
  const successOutput =
    "Sending 5, 100-byte ICMP Echos to " + target + ", timeout is 2 seconds:\n" +
    "!!!!!\n" +
    "Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms";

  // Only the simulated neighbor is a reachable destination at all —
  // we don't model a broader network to route toward.
  if (target !== SIMULATED_NEIGHBOR_IP) return timeoutOutput;

  // No interface configured/up — nothing to send from.
  if (!active) return timeoutOutput;

  // Configured and up, but wrong subnet for this neighbor — still
  // fails, teaching that correct addressing/masking matters, not
  // just "any IP configured."
  if (!sameSubnet(active.iface.ip, target, active.iface.mask)) return timeoutOutput;

  return successOutput;
}

function renderHelpCommands(device, showAll) {
  // v1.35.0: with ~90 commands now spanning many modes, a single flat
  // list (even with a "*" marker for unusable ones) had become
  // genuinely hard to use — per direction, most of a student's screen
  // was commands they couldn't currently run. Default behavior is now
  // to show ONLY commands usable in the current mode; "?commands all"
  // still shows everything, but per further direction, now grouped
  // into a section per mode (with a clear header) rather than one
  // flat list with a "*" marker — a command valid in multiple modes
  // appears once under EACH mode section it belongs to, since that's
  // more useful than picking just one "primary" mode for it.
  const usableInMode = COMMANDS.filter(function (cmd) { return cmd.modes.includes(device.mode); });
  const notUsable = COMMANDS.filter(function (cmd) { return !cmd.modes.includes(device.mode); });

  const lines = [
    "=== CCNA CLI Engine v" + IOS_ENGINE_VERSION + " — available commands ===",
    "(This is a training command, not real IOS.)", "",
    "Current mode: " + device.mode + "  (" + getPrompt(device) + ")", ""
  ];

  if (showAll) {
    // Fixed, sensible mode order (roughly: least to most "nested"),
    // rather than however modes happen to be discovered while
    // scanning COMMANDS — keeps the output structure predictable
    // across versions as more modes get added.
    const MODE_ORDER = ["user_exec", "priv_exec", "global_config", "interface_config", "line_config", "vlan_config"];
    const MODE_LABELS = {
      user_exec: "User EXEC mode (Router>)",
      priv_exec: "Privileged EXEC mode (Router#)",
      global_config: "Global configuration mode (Router(config)#)",
      interface_config: "Interface configuration mode (Router(config-if)#)",
      line_config: "Line configuration mode (Router(config-line)#)",
      vlan_config: "VLAN configuration mode (Router(config-vlan)#)"
    };
    for (let m = 0; m < MODE_ORDER.length; m++) {
      const mode = MODE_ORDER[m];
      const cmdsInMode = COMMANDS.filter(function (cmd) { return cmd.modes.includes(mode); });
      if (cmdsInMode.length === 0) continue;
      const isCurrent = mode === device.mode;
      lines.push("--- " + MODE_LABELS[mode] + (isCurrent ? "  <- you are here" : "") + " ---");
      for (let i = 0; i < cmdsInMode.length; i++) {
        lines.push("  " + cmdsInMode[i].help.padEnd(38) + " - " + cmdsInMode[i].description);
      }
      lines.push("");
    }
  } else {
    lines.push("Commands usable right now (" + usableInMode.length + "):", "");
    for (let i = 0; i < usableInMode.length; i++) {
      const cmd = usableInMode[i];
      lines.push("  " + cmd.help.padEnd(38) + " - " + cmd.description);
    }
    lines.push("", "  (" + notUsable.length + " more commands exist but aren't usable in this mode — type \"?commands all\" to see everything)");
  }
  return lines.join("\n");
}

/* ---------------------------------------------------------
   6. TOKENIZER / MATCHER
   --------------------------------------------------------- */

function tokenize(line) {
  return line.trim().split(/\s+/).filter(function (t) { return t.length > 0; });
}

function matchCommand(cmdTokens, inputTokens) {
  if (cmdTokens.length !== inputTokens.length) return null;
  const args = [];
  for (let i = 0; i < cmdTokens.length; i++) {
    const expected = cmdTokens[i], actual = inputTokens[i];
    if (expected.startsWith("<") && expected.endsWith(">")) { args.push(actual); }
    else if (expected.toLowerCase() !== actual.toLowerCase()) { return null; }
  }
  return args;
}

/* ---------------------------------------------------------
   6b. RESERVED WORDS (for realistic tab-completion ambiguity)
   ------------------------------------------------------------
   These are real IOS command words that this engine does NOT
   implement yet. They exist ONLY so that Tab-completion produces
   realistic ambiguity — e.g. typing "c" + Tab in priv_exec should
   NOT complete to "configure" the way it would if "configure"
   were the only priv_exec command starting with "c" in our small
   engine. Real IOS also has "copy", "clock", "clear", etc., so a
   real router would call "c" ambiguous. Listing those words here
   (without giving them any handler/behavior) recreates that.

   These words are NOT executable. Typing one in full still falls
   through to the normal "% Invalid input detected" / "not
   available in this mode" errors, exactly like any other command
   we haven't built — this list affects Tab behavior only.

   Curated to CCNA-relevant commands a student would plausibly
   encounter or type, not the full real-IOS command set (which is
   far larger and not useful to reproduce here).

   When a reserved word is later implemented for real (added to
   COMMANDS), remove it from this list — nothing else needs to
   change, since it already participated in completion checks.
   --------------------------------------------------------- */

const RESERVED_WORDS = {
  // v1.35.0: "ping" removed — now implemented for real (see COMMANDS).
  user_exec: {
    "": ["traceroute", "telnet", "connect", "resume", "logout"]
  },
  // v1.3.0: "copy", "erase", "reload" removed — implemented for real.
  // v1.35.0: "ping" removed — implemented for real.
  priv_exec: {
    "": ["clock", "clear", "connect", "debug", "delete", "dir",
         "no", "traceroute", "write",
         "undebug", "logout", "terminal"]
  },
  global_config: {
    "": ["banner", "ip", "no", "router", "vlan", "access-list",
         "crypto", "username", "spanning-tree", "clock", "logging",
         "ntp", "aaa"],
    // v1.35.0: real "ip ssh ?" siblings we haven't implemented —
    // confirmed via multiple independent Cisco documentation/community
    // sources: authentication-retries, port, rsa (keypair-name),
    // source-interface are all real, in addition to the version/
    // time-out/authentication-retries we've actually built. Only
    // listing the ones NOT already in COMMANDS, per the same
    // reserved-word principle used everywhere else.
    "ip ssh": ["port", "rsa", "source-interface", "maxstartups"]
  },
  interface_config: {
    "": ["description", "duplex", "speed", "switchport",
         "channel-group", "spanning-tree", "no"],
    // v1.35.0: deeper (position 2+) reserved words, added after a
    // real gap was found in testing — "switchport port-security" +
    // Tab completed with false confidence past "mac-address", because
    // real IOS also has a sibling "aging" sub-command
    // (switchport port-security aging ...) that we haven't
    // implemented. Keyed by the PATH of prior tokens (space-joined),
    // not just the mode, so completion honesty can be expressed at
    // any depth, not just the first word. Confirmed via Cisco's own
    // "switchport port-security ?" output: aging, mac-address,
    // maximum, violation, <cr> — "aging" is the one we're missing.
    "switchport port-security": ["aging"]
  },
  line_config: {
    "": ["exec-timeout", "transport", "no", "access-class"]
  }
};

/* ---------------------------------------------------------
   6c. TAB COMPLETION
   ------------------------------------------------------------
   Given the device's current mode and the raw line typed so far
   (which may end mid-word), figure out what the LAST token could
   complete to, the same way real IOS does: complete one token at
   a time, only offering literal keywords (never free-form args
   like <name>/<ip>/<password>), and only from commands valid in
   the current mode. Reserved words (see above) are included as
   candidates at ANY token position where a path entry exists for
   the tokens typed so far — originally only checked at the FIRST
   token position, which meant deeper/nested ambiguity (e.g. a
   command family we've partially implemented, like "switchport
   port-security", having an unbuilt sibling several tokens in) was
   silently reported as falsely unambiguous. Fixed in v1.35.0 after
   this was found in testing.

   Returns:
     { type: "none" }                          - no candidates
     { type: "unique", completedLine: "..." }   - exactly one match
     { type: "ambiguous", candidates: [...] }   - 2+ matches
   --------------------------------------------------------- */

// Shared core: given a mode, the tokens already fixed before this
// position, and a partial/full token at this position, returns the
// set of literal keyword candidates that match. Used by both
// getCompletions (Tab, completes only the LAST token) and
// resolveAbbreviations (Enter, expands EVERY token in the line).
function findCandidatesAt(device, priorTokens, completedTokenIndex, partial, includeReserved) {
  const candidateSet = new Set();
  for (let i = 0; i < COMMANDS.length; i++) {
    const cmd = COMMANDS[i];
    if (!cmd.modes.includes(device.mode)) continue;
    if (cmd.tokens.length <= completedTokenIndex) continue;

    let priorMatches = true;
    for (let j = 0; j < priorTokens.length; j++) {
      const expected = cmd.tokens[j];
      if (expected === undefined) { priorMatches = false; break; }
      if (expected.startsWith("<") && expected.endsWith(">")) continue; // free arg, anything goes
      if (expected.toLowerCase() !== priorTokens[j].toLowerCase()) { priorMatches = false; break; }
    }
    if (!priorMatches) continue;

    const tokenHere = cmd.tokens[completedTokenIndex];
    if (tokenHere === undefined) continue;
    if (tokenHere.startsWith("<") && tokenHere.endsWith(">")) continue; // can't complete a free arg

    // Bug found in testing (v1.35.0): several COMMANDS entries use a
    // pipe-separated token to document multiple valid literal words
    // in one slot (e.g. "inside|outside" for "ip nat inside/outside",
    // "in|out" for ACL/NAT direction). This function previously
    // treated the WHOLE pipe-joined string as one literal token, so
    // "inside|outside".startsWith("out") is false even though "out"
    // is a real, valid completion for the "outside" alternative —
    // "ip nat out" + Tab returned nothing. Fixed by splitting on "|"
    // and checking each alternative individually.
    const alternatives = tokenHere.indexOf("|") !== -1 ? tokenHere.split("|") : [tokenHere];
    for (let a = 0; a < alternatives.length; a++) {
      if (alternatives[a].toLowerCase().startsWith(partial.toLowerCase())) {
        candidateSet.add(alternatives[a]);
      }
    }
  }

  if (includeReserved) {
    const modeReserved = RESERVED_WORDS[device.mode];
    if (modeReserved) {
      // Path is the prior tokens, lowercased and space-joined — ""
      // for token position 0, matching the original position-0-only
      // behavior exactly when no deeper path entries exist.
      const path = priorTokens.map(function (t) { return t.toLowerCase(); }).join(" ");
      const reserved = modeReserved[path] || [];
      for (let i = 0; i < reserved.length; i++) {
        if (reserved[i].toLowerCase().startsWith(partial.toLowerCase())) {
          candidateSet.add(reserved[i]);
        }
      }
    }
  }

  return Array.from(candidateSet);
}

function getCompletions(device, rawLine) {
  // Do NOT trim trailing content — we need to know whether the line
  // ends mid-word (completing that word) or right after a space
  // (starting a new word with nothing typed yet).
  const ended_with_space = /\s$/.test(rawLine);
  const typedTokens = rawLine.trim().length === 0 ? [] : rawLine.trim().split(/\s+/);

  let completedTokenIndex;   // index of the token we are trying to complete
  let priorTokens;           // tokens before it, already fixed
  let partial;                // the partial text of the token being completed

  if (ended_with_space || typedTokens.length === 0) {
    // Starting a brand new token with nothing typed for it yet.
    completedTokenIndex = typedTokens.length;
    priorTokens = typedTokens;
    partial = "";
  } else {
    completedTokenIndex = typedTokens.length - 1;
    priorTokens = typedTokens.slice(0, -1);
    partial = typedTokens[completedTokenIndex];
  }

  // Special case: completing an interface TYPE name (the token right
  // after "interface"/"interfaces"). This slot is a free-form <name>
  // argument in the COMMANDS table, which findCandidatesAt()
  // deliberately skips for every other free-form argument (IPs,
  // passwords, hostnames — those have no fixed vocabulary to complete
  // against). Interface type names are different: real IOS DOES
  // complete "g" -> candidates among GigabitEthernet/FastEthernet/
  // Serial/etc.
  //
  // Generalized in v1.35.0 after this bug recurred a THIRD time —
  // originally handled only "interface <Type>" (v1.9.1/v1.12.0), then
  // "show interfaces <Type>" was added as a second special case
  // (v1.11.1), and "show ip interface <Type>" (added this same
  // version, v1.35.0) was found broken because it needed a THIRD
  // position (3, not 1 or 2) that had never been added. Rather than
  // keep adding one more length-specific check each time a new
  // command shape needs this, this now matches ANY prior-token
  // sequence whose LAST word is "interface" or "interfaces",
  // regardless of what precedes it or how long the sequence is —
  // covering all three known real cases plus any future command
  // shaped like "... interface(s) <Type>" without needing another
  // special case.
  const lastPriorToken = priorTokens.length > 0 ? priorTokens[priorTokens.length - 1].toLowerCase() : "";
  const interfaceTypeSlot =
    (lastPriorToken === "interface" || lastPriorToken === "interfaces") &&
    (device.mode === "global_config" || device.mode === "interface_config" ||
     device.mode === "user_exec" || device.mode === "priv_exec");

  if (interfaceTypeSlot) {
    const typeCandidates = INTERFACE_TYPES.filter(function (t) {
      return t.toLowerCase().startsWith(partial.toLowerCase());
    });
    if (typeCandidates.length === 1) {
      return { type: "unique", completedLine: priorTokens.concat([typeCandidates[0]]).join(" ") };
    }
    if (typeCandidates.length > 1) {
      return { type: "ambiguous", candidates: typeCandidates };
    }
    // Falls through to "none" below via the normal path if partial
    // matches no known interface type at all (e.g. genuinely unknown
    // input) — normal findCandidatesAt would also find nothing here
    // since <name> is skipped, so no special handling needed for
    // the empty-match case.
  }

  const candidates = findCandidatesAt(device, priorTokens, completedTokenIndex, partial, true);
  if (candidates.length === 0) return { type: "none" };

  // Same fix as resolveAbbreviations(): an exact full match always
  // wins over merely-shares-a-prefix candidates (e.g. tabbing after
  // a fully-typed "ip" should complete/confirm "ip", not report
  // ambiguity with "ipv6" just because "ip" is a prefix of it).
  const exactMatch = candidates.find(function (c) {
    return c.toLowerCase() === partial.toLowerCase();
  });
  if (exactMatch) {
    return { type: "unique", completedLine: priorTokens.concat([exactMatch]).join(" ") };
  }

  if (candidates.length > 1) return { type: "ambiguous", candidates: candidates };

  const completedToken = candidates[0];

  // If the "unique" match is actually a reserved (unimplemented) word,
  // still complete it visually — real IOS would too, it just wouldn't
  // do anything useful once executed. Our engine already handles that
  // correctly via the normal "not implemented" error path.
  const finishedLine = priorTokens.concat([completedToken]).join(" ");
  return { type: "unique", completedLine: finishedLine };
}

/* ---------------------------------------------------------
   6d. ABBREVIATION RESOLUTION (Enter-time, not just Tab)
   ------------------------------------------------------------
   Real IOS accepts unambiguous abbreviations directly at Enter,
   not only via Tab (e.g. "conf t" + Enter works, not just "conf"
   + Tab + "t" + Tab). This walks every token of the input and
   expands any that uniquely match a literal keyword, using the
   exact same candidate logic as Tab completion so the two stay
   consistent by construction.

   Free-form argument tokens (IPs, passwords, names, etc.) are left
   untouched — abbreviation only applies to literal command
   keywords, never to values the student is entering.

   Returns:
     { ok: true, resolvedLine: "..." }
     { ok: false, error: "..." }   - either no match or ambiguous
                                      at some token position
   --------------------------------------------------------- */

function resolveAbbreviations(device, rawLine) {
  const tokens = tokenize(rawLine);
  if (tokens.length === 0) return { ok: true, resolvedLine: rawLine };

  const resolved = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const candidates = findCandidatesAt(device, resolved, i, token, true);

    // Exact full match always wins immediately, even if OTHER
    // candidates also happen to share this token as a prefix (e.g.
    // "ip" is itself a prefix of "ipv6" — real IOS still treats a
    // fully-typed "ip" as unambiguous, not "ambiguous between ip and
    // ipv6"). Bug found in testing (v1.35.0): adding "ipv6" as a
    // keyword broke every existing "ip address"/"ip domain-lookup"
    // command, since candidates.length was 2 and this check used to
    // run AFTER the ambiguous-length check instead of before it.
    const exactMatch = candidates.find(function (c) {
      return c.toLowerCase() === token.toLowerCase();
    });
    if (exactMatch) {
      resolved.push(exactMatch);
      continue;
    }

    if (candidates.length === 1) {
      // Unique abbreviation — expand it.
      resolved.push(candidates[0]);
      continue;
    }

    if (candidates.length > 1) {
      return {
        ok: false,
        error: "% Ambiguous command: \"" + rawLine.trim() + "\"  (possible: " + candidates.join(", ") + ")"
      };
    }

    // No literal keyword candidates at this position — this token is
    // either a free-form argument (IP, password, name, etc.) at a
    // position some command expects one, or it's genuinely not part
    // of any known command. Either way, pass it through unchanged;
    // the normal exact-match executor below will sort out which case
    // it is and give the right error if it's truly invalid.
    resolved.push(token);
  }

  return { ok: true, resolvedLine: resolved.join(" ") };
}

/* ---------------------------------------------------------
   7. MAIN EXECUTE FUNCTION
   --------------------------------------------------------- */

// Handles a single line of input when the device has an active
// interactive prompt (copy/erase/reload). Each prompt type may need
// more than one exchange (e.g. reload asks Save? then Proceed?), so
// this can itself set device.pendingPrompt to the NEXT prompt in the
// sequence rather than clearing it.
function handlePendingPrompt(device, rawLine) {
  const answer = rawLine.trim();
  const prompt = device.pendingPrompt;

  if (prompt.type === "copy_destination") {
    // Real IOS: Enter alone accepts the bracketed default [startup-config].
    // Any other typed filename is still accepted the same way for our
    // teaching purposes — we don't model alternate destination files.
    device.pendingPrompt = null;
    device.startupConfig = snapshotConfig(device);
    return {
      text: "Building configuration...\n[OK]",
      error: null,
      promptAfter: getPrompt(device)
    };
  }

  if (prompt.type === "erase_confirm") {
    device.pendingPrompt = null;
    // Real IOS: default is confirm — anything except an explicit "no"
    // style abort proceeds. Blank Enter is the common case.
    device.startupConfig = null;
    return {
      text: "[OK]\nErase of nvram: complete",
      error: null,
      promptAfter: getPrompt(device)
    };
  }

  if (prompt.type === "reload_save") {
    const wantsSave = answer.toLowerCase() === "yes" || answer.toLowerCase() === "y";
    const wantsNoSave = answer.toLowerCase() === "no" || answer.toLowerCase() === "n";
    if (!wantsSave && !wantsNoSave) {
      // Real IOS re-prompts on unrecognized input rather than guessing.
      return {
        text: "System configuration has been modified. Save? [yes/no]:",
        error: null,
        promptAfter: getPrompt(device)
      };
    }
    if (wantsSave) {
      device.startupConfig = snapshotConfig(device);
    }
    device.pendingPrompt = { type: "reload_confirm" };
    return { text: "Proceed with reload? [confirm]", error: null, promptAfter: getPrompt(device) };
  }

  if (prompt.type === "reload_confirm") {
    device.pendingPrompt = null;
    applyConfigSnapshot(device, device.startupConfig);
    return {
      text: "\nSystem Bootstrap...\n" + device.hostname + " console is now available\n\nPress RETURN to get started.",
      error: null,
      promptAfter: getPrompt(device)
    };
  }

  // Should not happen, but fail safe rather than silently doing nothing.
  device.pendingPrompt = null;
  return { text: null, error: "% Internal error: unknown pending prompt", promptAfter: getPrompt(device) };
}

// Renamed from "executeLine" to make room for the new outer wrapper
// below, which adds "| begin/include/exclude <pattern>" output
// filtering (v1.35.0) without touching any of this function's
// internal logic at all — every special case and COMMANDS lookup
// here is completely unaware filtering exists.
function executeLineInner(device, rawLine) {
  const trimmed = rawLine.trim();

  // If the device is mid-interactive-prompt (copy/erase/reload), the
  // next input is an ANSWER to that prompt, not a normal command —
  // even if it's blank (Enter alone accepts the default, matching
  // real IOS behavior for these specific prompts).
  if (device.pendingPrompt) {
    return handlePendingPrompt(device, rawLine);
  }

  if (trimmed.length === 0) return { text: null, error: null, promptAfter: getPrompt(device) };

  if (trimmed === "?commands" || trimmed === "?commands all") {
    return { text: renderHelpCommands(device, trimmed === "?commands all"), error: null, promptAfter: getPrompt(device) };
  }

  // Special case: "banner motd <delim>text<delim>" — real IOS lets the
  // user pick any single delimiter character, and the banner text can
  // contain spaces, so this can't go through the fixed-token matcher
  // used for every other command. Only valid in global_config.
  if (/^banner\s+motd\s+\S/i.test(trimmed)) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    // Strip "banner motd " (with any amount of whitespace) to get to the delimiter.
    const afterKeyword = trimmed.replace(/^banner\s+motd\s+/i, "");
    const delimiter = afterKeyword.charAt(0);
    const rest = afterKeyword.slice(1);
    const closeIndex = rest.indexOf(delimiter);
    if (closeIndex === -1) {
      return {
        text: null,
        error: "% Incomplete command. The banner text must start and end with the same delimiter character.",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    const bannerText = rest.slice(0, closeIndex);
    device.bannerMotd = bannerText;
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "banner_motd" };
  }

  // Special case: "interface <Type> <slot/port>" — real IOS accepts a
  // space between the interface type name and its numbering (verified
  // against Cisco documentation: "interface GigabitEthernet 0/0/0" is
  // valid input, even though the canonical/displayed form has no
  // space, "GigabitEthernet0/0/0"). Collapse that one space here,
  // before tokenizing, so "interface GigabitEthernet 0/0/0" and
  // "interface GigabitEthernet0/0/0" behave identically downstream.
  // Also applies to "show interfaces <Type> <slot/port>" — bug found
  // in testing (v1.9.1): this normalization originally only matched
  // lines starting with "interface ", so "show interfaces
  // GigabitEthernet 0/0/0" (with a space) failed even though
  // "interface GigabitEthernet 0/0/0" worked. Both forms now share
  // one normalization step.
  // CRITICAL: explicitly excludes "vlan" as a matched type name (via
  // negative lookahead). Bug found in testing (v1.35.0): "interface
  // vlan 10" was being mangled into "interfacevlan10"-shaped tokens
  // by this same regex (since "vlan" matches [A-Za-z]+ just like
  // "GigabitEthernet" does), which bypassed the "interface_vlan"
  // command's VLAN-must-already-exist check entirely by falling
  // through to the generic free-form "interface <name>" command
  // instead — silently creating a bogus interface for a VLAN that
  // was never actually created via "vlan <id>" first. "interface
  // vlan <id>" is its own dedicated command with its own token
  // pattern (["interface","vlan","<id>"]) and must never be rewritten
  // by this regex.
  let workingLine = trimmed;
  // Generalized fix (v1.25.0, further generalized in v1.35.0): this
  // exact bug shape (interface <Type> <slot>, show interfaces <Type>
  // <slot> [trunk], show port-security interface <Type> <slot>, show
  // ip interface <Type> <slot>) kept recurring because each new "show
  // ... interface(s) ... <Type> <slot>"-shaped command needed its own
  // copy-pasted special case (flagged as a recurring pattern back in
  // v1.18.0's changelog). The v1.25.0 fix generalized to any FIXED
  // set of known prefixes, but that still broke for a new prefix
  // shape (v1.35.0's "show ip ospf interface <Type> <slot>" didn't
  // match, since "ospf" wasn't in the hardcoded prefix list). Fixed
  // properly this time: the regex now matches ANY text at all ending
  // in the word "interface" or "interfaces", immediately followed by
  // "<Type> <slot/port>[.<subif>]" and an optional trailing word —
  // genuinely prefix-agnostic, so it will keep working for any future
  // command shaped this way without ever needing another change here.
  const genericIfaceSpaceMatch = trimmed.match(
    /^(.*\binterfaces?)\s+(?!vlan\s)([A-Za-z]+)\s+(\d\S*)(\s+\S+)?$/i
  );
  if (genericIfaceSpaceMatch) {
    workingLine = genericIfaceSpaceMatch[1] + " " + genericIfaceSpaceMatch[2] + genericIfaceSpaceMatch[3] + (genericIfaceSpaceMatch[4] || "");
  }

  // Special case: "description <free text with spaces>" — like banner,
  // this needs to accept the entire rest of the line as one value,
  // which the fixed-token matcher can't express (it requires an exact
  // token-count match). Only valid in interface_config.
  const descMatch = workingLine.match(/^description\s+(.+)$/i);
  if (descMatch) {
    if (device.mode !== "interface_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    getOrCreateInterface(device, device.currentInterface).description = descMatch[1];
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "description" };
  }

  // Special case: "ip route <network> <mask> <next-hop> [AD]" — the
  // trailing administrative distance is OPTIONAL (used for floating
  // static routes), which the fixed-token matcher can't express since
  // it requires an exact token count. Only valid in global_config.
  const ipRouteMatch = workingLine.match(/^ip\s+route\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\d+))?$/i);
  if (ipRouteMatch) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    const network = ipRouteMatch[1], mask = ipRouteMatch[2], nextHop = ipRouteMatch[3];
    const adminDistance = ipRouteMatch[4] !== undefined ? Number(ipRouteMatch[4]) : 1; // real IOS default AD for static routes
    if (!isValidIPv4(network) || !isValidMask(mask) || !isValidIPv4(nextHop)) {
      return { text: null, error: "% Invalid input detected", promptAfter: getPrompt(device), commandId: null };
    }
    // Real IOS silently replaces an existing route to the same
    // network/mask/next-hop if re-entered (e.g. correcting a typo'd
    // AD) rather than creating a duplicate entry.
    const existingIdx = device.staticRoutes.findIndex(function (r) {
      return r.network === network && r.mask === mask && r.nextHop === nextHop;
    });
    const routeEntry = { network: network, mask: mask, nextHop: nextHop, adminDistance: adminDistance };
    if (existingIdx !== -1) device.staticRoutes[existingIdx] = routeEntry;
    else device.staticRoutes.push(routeEntry);
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "ip_route" };
  }

  // Special case: "no ip route <network> <mask> <next-hop> [AD]" —
  // same optional-trailing-arg shape as "ip route" above, needed to
  // actually remove a configured static route (e.g. to test floating
  // route failover by removing the primary). Real IOS matches on
  // network+mask+next-hop regardless of whether the AD is included in
  // the removal command, so the trailing AD (if given) is accepted
  // but not required to match.
  const noIpRouteMatch = workingLine.match(/^no\s+ip\s+route\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\d+))?$/i);
  if (noIpRouteMatch) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    const network = noIpRouteMatch[1], mask = noIpRouteMatch[2], nextHop = noIpRouteMatch[3];
    const existingIdx = device.staticRoutes.findIndex(function (r) {
      return r.network === network && r.mask === mask && r.nextHop === nextHop;
    });
    if (existingIdx === -1) {
      return { text: null, error: "% Invalid input detected", promptAfter: getPrompt(device), commandId: null };
    }
    device.staticRoutes.splice(existingIdx, 1);
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "no_ip_route" };
  }

  // Special case: "encapsulation dot1Q <vlan-id> [native]" — the
  // trailing "native" keyword is OPTIONAL, same shape as "ip route"'s
  // optional AD. Only valid on a subinterface (real IOS rejects this
  // on a physical interface — verified via the ground-truth reference
  // and general 802.1Q trunking rules: encapsulation only applies to
  // a logical trunk sub-link, not the parent physical port).
  const encapMatch = workingLine.match(/^encapsulation\s+dot1[qQ]\s+(\d+)(?:\s+(native))?$/i);
  if (encapMatch) {
    if (device.mode !== "interface_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    if (!isSubinterfaceName(device.currentInterface)) {
      return { text: null, error: "% Invalid input detected", promptAfter: getPrompt(device), commandId: null };
    }
    const iface = getOrCreateInterface(device, device.currentInterface);
    iface.dot1qVlan = Number(encapMatch[1]);
    iface.dot1qNative = !!encapMatch[2];
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "encapsulation_dot1q" };
  }

  // Special case: "access-list <n> permit|deny host <ip>" or
  // "access-list <n> permit|deny <network> <wildcard>" — two
  // genuinely different token counts for the same command, so a
  // single fixed-token COMMANDS entry can't express both; handled
  // here as two alternate patterns instead. Auto-assigns a sequence
  // number (10, 20, 30...) per entry within the ACL, and creates the
  // ACL on first use — same auto-creation pattern as VLANs/DHCP
  // pools. Format verified EXACTLY against a real Packet Tracer
  // capture (v1.35.0): "permit 192.168.20.0 0.0.0.255" — NO "wildcard
  // bits" phrase in the stored/displayed form (this project's own
  // ground-truth reference text had shown "wildcard bits", which
  // turned out to be inaccurate compared to the real capture).
  const aclHostMatch = workingLine.match(/^access-list\s+(\d+)\s+(permit|deny)\s+host\s+(\S+)$/i);
  const aclNetworkMatch = workingLine.match(/^access-list\s+(\d+)\s+(permit|deny)\s+(\S+)\s+(\S+)$/i);
  if (aclHostMatch || aclNetworkMatch) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    const m = aclHostMatch || aclNetworkMatch;
    const number = m[1], action = m[2].toLowerCase();
    let entry;
    if (aclHostMatch) {
      if (!isValidIPv4(m[3])) return { text: null, error: "% Invalid input detected", promptAfter: getPrompt(device), commandId: null };
      entry = { action: action, matchType: "host", host: m[3] };
    } else {
      if (!isValidIPv4(m[3]) || !isValidIPv4(m[4])) return { text: null, error: "% Invalid input detected", promptAfter: getPrompt(device), commandId: null };
      entry = { action: action, matchType: "network", network: m[3], wildcard: m[4] };
    }
    if (!device.accessLists[number]) {
      device.accessLists[number] = { type: "standard", entries: [] };
    }
    device.accessLists[number].entries.push(entry);
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "access_list_standard" };
  }

  // Special case: "ip access-group <n> in|out" — a plain fixed-token
  // shape, but handled here rather than in COMMANDS since it needs to
  // validate the ACL number/name against device.accessLists (real IOS
  // accepts binding a not-yet-defined ACL number without error, so no
  // validation is actually needed here beyond basic shape — kept as a
  // special case mainly for symmetry with the access-list command
  // above, and to keep both ACL-related commands' logic together).
  const aclGroupMatch = workingLine.match(/^ip\s+access-group\s+(\S+)\s+(in|out)$/i);
  if (aclGroupMatch) {
    if (device.mode !== "interface_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    const iface = getOrCreateInterface(device, device.currentInterface);
    if (aclGroupMatch[2].toLowerCase() === "in") iface.inboundAccessList = aclGroupMatch[1];
    else iface.outboundAccessList = aclGroupMatch[1];
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "ip_access_group" };
  }

  // Special case: "ip access-list extended <name>" — creates the
  // named ACL (auto-creation, same pattern as standard ACLs/VLANs/
  // DHCP pools) and enters ext_nacl_config mode.
  const extAclMatch = workingLine.match(/^ip\s+access-list\s+extended\s+(\S+)$/i);
  if (extAclMatch) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    const name = extAclMatch[1];
    if (!device.accessLists[name]) {
      device.accessLists[name] = { type: "extended", entries: [] };
    }
    device.currentExtAcl = name;
    device.mode = "ext_nacl_config";
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "ip_access_list_extended" };
  }

  // Special case: extended ACL entries — "permit|deny tcp|udp <src>
  // <dst> [eq <port>]" or "... established". Source/dest can each be
  // "any", "host <ip>", or "<network> <wildcard>" — genuinely
  // variable token counts depending on which form is used on EACH
  // side independently, which is why this needs careful positional
  // parsing rather than a single fixed regex.
  if (device.mode === "ext_nacl_config") {
    const tokens = trimmed.split(/\s+/);
    const action = tokens[0] ? tokens[0].toLowerCase() : "";
    const protocol = tokens[1] ? tokens[1].toLowerCase() : "";
    if ((action === "permit" || action === "deny") && (protocol === "tcp" || protocol === "udp")) {
      let pos = 2;
      function parseAddress() {
        if (tokens[pos] && tokens[pos].toLowerCase() === "any") {
          pos += 1;
          return { kind: "any" };
        }
        if (tokens[pos] && tokens[pos].toLowerCase() === "host" && tokens[pos + 1]) {
          const ip = tokens[pos + 1];
          pos += 2;
          return { kind: "host", ip: ip };
        }
        if (tokens[pos] && tokens[pos + 1]) {
          const network = tokens[pos], wildcard = tokens[pos + 1];
          pos += 2;
          return { kind: "network", network: network, wildcard: wildcard };
        }
        return null;
      }
      const src = parseAddress();
      const dst = src ? parseAddress() : null;
      if (!src || !dst) {
        return { text: null, error: "% Invalid input detected", promptAfter: getPrompt(device), commandId: null };
      }
      let port = null, established = false;
      if (tokens[pos] && tokens[pos].toLowerCase() === "eq" && tokens[pos + 1]) {
        port = tokens[pos + 1];
        pos += 2;
      } else if (tokens[pos] && tokens[pos].toLowerCase() === "established") {
        established = true;
        pos += 1;
      }
      if (pos !== tokens.length) {
        return { text: null, error: "% Invalid input detected", promptAfter: getPrompt(device), commandId: null };
      }
      device.accessLists[device.currentExtAcl].entries.push({
        type: "extended", action: action, protocol: protocol, src: src, dst: dst, port: port, established: established
      });
      return { text: null, error: null, promptAfter: getPrompt(device), commandId: "acl_extended_entry" };
    }
  }

  // Special case: "ip nat inside" / "ip nat outside" — marks the
  // current interface's NAT role. Plain fixed shape, but handled here
  // (not COMMANDS) to keep all NAT-related special cases together.
  const natRoleMatch = workingLine.match(/^ip\s+nat\s+(inside|outside)$/i);
  if (natRoleMatch) {
    if (device.mode !== "interface_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    getOrCreateInterface(device, device.currentInterface).natRole = natRoleMatch[1].toLowerCase();
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "ip_nat_role" };
  }

  // Special case: "ip nat inside source static <local> <global>" —
  // one-to-one static NAT mapping.
  const natStaticMatch = workingLine.match(/^ip\s+nat\s+inside\s+source\s+static\s+(\S+)\s+(\S+)$/i);
  if (natStaticMatch) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    if (!isValidIPv4(natStaticMatch[1]) || !isValidIPv4(natStaticMatch[2])) {
      return { text: null, error: "% Invalid input detected", promptAfter: getPrompt(device), commandId: null };
    }
    device.natStaticRules.push({ localIp: natStaticMatch[1], globalIp: natStaticMatch[2] });
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "ip_nat_static" };
  }

  // Special case: "ip nat pool <name> <start> <end> netmask <mask>"
  const natPoolMatch = workingLine.match(/^ip\s+nat\s+pool\s+(\S+)\s+(\S+)\s+(\S+)\s+netmask\s+(\S+)$/i);
  if (natPoolMatch) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    if (!isValidIPv4(natPoolMatch[2]) || !isValidIPv4(natPoolMatch[3]) || !isValidMask(natPoolMatch[4])) {
      return { text: null, error: "% Invalid input detected", promptAfter: getPrompt(device), commandId: null };
    }
    device.natPools[natPoolMatch[1]] = { start: natPoolMatch[2], end: natPoolMatch[3], netmask: natPoolMatch[4] };
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "ip_nat_pool" };
  }

  // Special case: "ip nat inside source list <acl> pool <name>
  // [overload]" or "ip nat inside source list <acl> interface <name>
  // overload" — Dynamic NAT and both PAT variants share this one
  // command shape, distinguished by "pool" vs "interface" and the
  // optional trailing "overload".
  //
  // Bug found in testing (v1.35.0): this matched against "trimmed"
  // (the RAW input), not "workingLine" (which has interface-name
  // spaces already collapsed by the generic regex above) — meaning
  // "ip nat inside source list 1 interface GigabitEthernet 0/0/1
  // overload" (with a space in the interface name, exactly how a
  // student types it, matching this project's own exercise data)
  // never matched at all. This reveals a BROADER latent gap: every
  // special case added since v1.25.0 introduced the generic
  // space-collapsing regex has matched against "trimmed" instead of
  // "workingLine", meaning NONE of them actually benefited from that
  // fix — access-list, ip access-group, and the extended-ACL-entry
  // special cases likely have the same latent issue for any future
  // command embedding an interface name with a space. Fixed here for
  // NAT specifically; worth revisiting the others in a future pass.
  const natListPoolMatch = workingLine.match(/^ip\s+nat\s+inside\s+source\s+list\s+(\S+)\s+pool\s+(\S+)(\s+overload)?$/i);
  const natListInterfaceMatch = workingLine.match(/^ip\s+nat\s+inside\s+source\s+list\s+(\S+)\s+interface\s+(\S+)\s+overload$/i);
  if (natListPoolMatch || natListInterfaceMatch) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    if (natListPoolMatch) {
      device.natDynamicRules.push({
        aclNumber: natListPoolMatch[1], poolName: natListPoolMatch[2],
        interfaceName: null, overload: !!natListPoolMatch[3]
      });
    } else {
      device.natDynamicRules.push({
        aclNumber: natListInterfaceMatch[1], poolName: null,
        interfaceName: normalizeInterfaceName(natListInterfaceMatch[2]), overload: true
      });
    }
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "ip_nat_dynamic" };
  }

  // Special case: "snmp-server community <string> ro|rw"
  const snmpCommunityMatch = workingLine.match(/^snmp-server\s+community\s+(\S+)\s+(ro|rw)$/i);
  if (snmpCommunityMatch) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    device.snmpCommunities.push({ string: snmpCommunityMatch[1], access: snmpCommunityMatch[2].toLowerCase() });
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "snmp_server_community" };
  }

  // Special case: "snmp-server location <rest of line>" / "snmp-server
  // contact <rest of line>" — like banner/description, these need the
  // ENTIRE rest of the line as one free-form value (the ground-truth
  // reference confirms "Cisco NetAcad" is a multi-word location), not
  // fixed-token matching.
  const snmpLocationMatch = workingLine.match(/^snmp-server\s+location\s+(.+)$/i);
  if (snmpLocationMatch) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    device.snmpLocation = snmpLocationMatch[1];
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "snmp_server_location" };
  }
  const snmpContactMatch = workingLine.match(/^snmp-server\s+contact\s+(.+)$/i);
  if (snmpContactMatch) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    device.snmpContact = snmpContactMatch[1];
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "snmp_server_contact" };
  }

  // Special case: "snmp-server host <ip> version 2c <community>"
  const snmpHostMatch = workingLine.match(/^snmp-server\s+host\s+(\S+)\s+version\s+(\S+)\s+(\S+)$/i);
  if (snmpHostMatch) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    if (!isValidIPv4(snmpHostMatch[1])) {
      return { text: null, error: "% Invalid input detected", promptAfter: getPrompt(device), commandId: null };
    }
    device.snmpHost = { ip: snmpHostMatch[1], version: snmpHostMatch[2], community: snmpHostMatch[3] };
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "snmp_server_host" };
  }

  // Special case: "logging source-interface <Type> <slot/port>" —
  // needs the same interface-space handling as other interface-name
  // arguments (e.g. "Loopback 0"), so it's matched against
  // workingLine (space already collapsed) rather than trimmed.
  const loggingSourceIfaceMatch = workingLine.match(/^logging\s+source-interface\s+(\S+)$/i);
  if (loggingSourceIfaceMatch) {
    if (device.mode !== "global_config") {
      return {
        text: null,
        error: "% Command not available in this mode (" + device.mode + ")",
        promptAfter: getPrompt(device), commandId: null
      };
    }
    device.loggingSourceInterface = normalizeInterfaceName(loggingSourceIfaceMatch[1]);
    return { text: null, error: null, promptAfter: getPrompt(device), commandId: "logging_source_interface" };
  }

  // Abbreviation resolution: expand any unambiguous abbreviated
  // keyword tokens to their full form before matching against the
  // command table, so "conf t" behaves identically to "configure
  // terminal". Free-form argument tokens (IPs, passwords, names) pass
  // through untouched. Deliberately runs AFTER the banner special
  // case above, since banner text is arbitrary free text that must
  // never be reinterpreted as command keywords.
  const abbrevResult = resolveAbbreviations(device, workingLine);
  if (!abbrevResult.ok) {
    return { text: null, error: abbrevResult.error, promptAfter: getPrompt(device), commandId: null };
  }
  const resolvedLine = abbrevResult.resolvedLine;

  const inputTokens = tokenize(resolvedLine);
  let matchedAnyShape = false;

  // Bug found in testing (v1.35.0): when two commands' token patterns
  // can both match the same input at the same length — e.g. "show ip
  // interface brief" (all-literal tokens) vs. "show ip interface
  // <name>" (a wildcard in the last slot) both matching "show ip
  // interface brief" — this loop previously returned whichever
  // matched FIRST in COMMANDS array order, which is fragile: it
  // happened to work purely by luck of insertion order until a new
  // command was added earlier in the array. Fixed by collecting ALL
  // matching command shapes (regardless of mode) first, then
  // preferring the one with the FEWEST wildcard tokens — a literal,
  // fully-specific match like "brief" should always beat a wildcard
  // "<name>" slot claiming the same words, matching how a real
  // person would expect the more specific command to take priority.
  const candidates = [];
  for (let i = 0; i < COMMANDS.length; i++) {
    const cmd = COMMANDS[i];
    const args = matchCommand(cmd.tokens, inputTokens);
    if (args === null) continue;
    matchedAnyShape = true;
    const wildcardCount = cmd.tokens.filter(function (t) { return t.startsWith("<") && t.endsWith(">"); }).length;
    candidates.push({ cmd: cmd, args: args, wildcardCount: wildcardCount });
  }
  candidates.sort(function (a, b) { return a.wildcardCount - b.wildcardCount; });

  for (let i = 0; i < candidates.length; i++) {
    const cmd = candidates[i].cmd;
    if (!cmd.modes.includes(device.mode)) continue;
    const result = cmd.handler(device, candidates[i].args);
    return { text: result.text, error: result.error, promptAfter: getPrompt(device), commandId: cmd.id };
  }

  if (matchedAnyShape) {
    return {
      text: null,
      error: "% Command not available in this mode (" + device.mode + ")",
      promptAfter: getPrompt(device), commandId: null
    };
  }
  return { text: null, error: "% Invalid input detected", promptAfter: getPrompt(device), commandId: null };
}

/* ---------------------------------------------------------
   OUTPUT FILTERING — "| begin/include/exclude <pattern>", added
   v1.35.0. Confirmed via a real router capture that this project's
   engine did NOT support this at all (a real router rejected
   "show run | begin router ospf" with "% Invalid input detected" —
   wait, actually the real router in that capture rejected it because
   THAT specific IOS image/context didn't support piping there, which
   is why this was flagged as a genuine feature gap rather than
   something to skip: "| begin"/"| include"/"| exclude" ARE real,
   widely-used, and CCNA-relevant IOS features in general, independent
   of that one router's specific behavior.

   Deliberately scoped as a GENERIC layer applied to ANY command's
   output, not built per-command — this matches how real IOS treats
   piping (it works after any "show" command, not a special few) and
   is far less work than teaching every individual renderer about
   filtering. Scope for this first pass: "begin", "include", "exclude"
   only (the three most common, CCNA-relevant filters) — "section"
   and regex-pattern matching are NOT included, only plain
   case-sensitive substring matching (matching real IOS's own default
   behavior — "terminal no case-sensitive" or similar would be needed
   to change that, which isn't modeled here). Tab-completion after
   "|" (e.g. "show run | ?") is also not built in this pass.
   --------------------------------------------------------- */

function applyOutputFilter(text, filterType, pattern) {
  if (text === null || text === undefined) return text;
  const lines = text.split("\n");
  if (filterType === "begin") {
    const idx = lines.findIndex(function (l) { return l.indexOf(pattern) !== -1; });
    return idx === -1 ? "" : lines.slice(idx).join("\n");
  }
  if (filterType === "include") {
    return lines.filter(function (l) { return l.indexOf(pattern) !== -1; }).join("\n");
  }
  if (filterType === "exclude") {
    return lines.filter(function (l) { return l.indexOf(pattern) === -1; }).join("\n");
  }
  return text;
}

// Public entry point — detects a "|" pipe, splits the line into the
// base command and the filter clause, runs the base command through
// the real (unmodified) engine, then filters its output. A line with
// no pipe behaves EXACTLY as before (falls straight through to
// executeLineInner with zero overhead or behavior change).
function executeLine(device, rawLine) {
  const pipeIndex = rawLine.indexOf("|");
  if (pipeIndex === -1) {
    return executeLineInner(device, rawLine);
  }

  const baseCommand = rawLine.slice(0, pipeIndex).trim();
  const filterClause = rawLine.slice(pipeIndex + 1).trim();
  const filterMatch = filterClause.match(/^(begin|include|exclude)\s+(.+)$/i);

  if (!filterMatch) {
    // Real IOS rejects an unrecognized or malformed filter clause
    // with a caret pointing at the "|" itself — matching a real
    // capture from this project's own research showing exactly this
    // rejection shape for a filter this specific IOS build didn't
    // support at that moment.
    return {
      text: null,
      error: "% Invalid input detected",
      promptAfter: getPrompt(device),
      commandId: null
    };
  }

  const result = executeLineInner(device, baseCommand);
  // Only filter successful, text-producing results — an error or a
  // config-mode command with no output passes through unchanged
  // (piping "configure terminal | include foo" wouldn't make sense
  // and real IOS would reject it at the "% Invalid input detected"
  // stage before ever reaching the pipe, but since our engine already
  // rejects malformed/unsupported command lines on their own merits,
  // simply not touching non-text results here is the safe behavior).
  if (result.error || result.text === null) {
    return result;
  }
  const filteredText = applyOutputFilter(result.text, filterMatch[1].toLowerCase(), filterMatch[2]);
  return {
    text: filteredText,
    error: null,
    promptAfter: result.promptAfter,
    commandId: result.commandId
  };
}

/* ============================================================
   8. EXERCISE ENGINE
   ============================================================ */

const EXERCISES = [
  {
    id: "c1_syn_2.2_navigate_ios_modes",
    deviceType: "switch", // used to warn if Free Practice left the shared device as a router
    moduleLabel: "Course 1 · SyntxChk · 2.2 — Navigate Between IOS Modes",
    status: "available",
    steps: [
      { instruction: "Enter privileged EXEC mode using the enable command.", expected: "enable",
        hint: "You're in user EXEC mode (prompt ends with >). One command takes you to privileged EXEC mode." },
      { instruction: "Return to user EXEC mode using the disable command.", expected: "disable",
        hint: "You're in privileged EXEC mode (prompt ends with #). The opposite of 'enable' takes you back." },
      { instruction: "Re-enter privileged EXEC mode.", expected: "enable",
        hint: "Same command as step 1." },
      { instruction: "Enter global configuration mode using the configure terminal command.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Exit global configuration mode and return to privileged EXEC mode using the exit command.", expected: "exit",
        hint: "One word takes you up one level from global config mode." },
      { instruction: "Re-enter global configuration mode.", expected: "configure terminal",
        hint: "Same command as step 4." },
      { instruction: "Enter line subconfiguration mode for the console port using the line console 0 command.", expected: "line console 0",
        hint: "Three words: line, console, then the line number 0." },
      { instruction: "Return to global configuration mode using the exit command.", expected: "exit",
        hint: "One word takes you up one level from line config mode." },
      { instruction: "Enter VTY line subconfiguration mode using the line vty 0 15 command.", expected: "line vty 0 15",
        hint: "Like line console 0, but 'vty' instead of 'console', with a range 0 15." },
      { instruction: "Return to global configuration mode.", expected: "exit",
        hint: "Same command as step 8." },
      { instruction: "Enter the VLAN 1 interface subconfiguration mode using the interface vlan 1 command.", expected: "interface vlan 1",
        hint: "Three words: interface, vlan, then the number 1." },
      { instruction: "From interface configuration mode, switch to line console subconfiguration mode using the line console 0 global configuration command.", expected: "line console 0",
        hint: "Same command as step 7 — it also works directly from interface config mode." },
      { instruction: "Return to privileged EXEC mode using the end command.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." }
    ]
  },
  {
    id: "c1_syn_2.4_basic_device_configuration",
    deviceType: "switch", // used to warn if Free Practice left the shared device as a router
    moduleLabel: "Course 1 · SyntxChk · 2.4 — Basic Device Configuration",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Name the switch Sw-Floor-1 using the hostname command.", expected: "hostname Sw-Floor-1",
        hint: "hostname <name> — the name is Sw-Floor-1." },
      { instruction: "Enter line console 0 subconfiguration mode.", expected: "line console 0",
        hint: "Three words: line, console, then the line number 0." },
      { instruction: "Assign the password 'cisco' to the console line.", expected: "password cisco",
        hint: "password <password> — the password is cisco." },
      { instruction: "Enable login on the console line.", expected: "login",
        hint: "One word — without login, the password would not be required." },
      { instruction: "Return to global configuration mode.", expected: "exit",
        hint: "One word takes you up one level from line config mode." },
      { instruction: "Set the privileged EXEC enable secret to 'class'.", expected: "enable secret class",
        hint: "enable secret <password> — uses MD5, stronger than enable password." },
      { instruction: "Enter VTY line configuration for lines 0 through 15.", expected: "line vty 0 15",
        hint: "Like line console 0, but 'vty' instead of 'console', with a range 0 15." },
      { instruction: "Assign the password 'cisco' to the VTY lines.", expected: "password cisco",
        hint: "Same command as on the console line." },
      { instruction: "Enable login on the VTY lines.", expected: "login",
        hint: "Same command as on the console line." },
      { instruction: "Return to global configuration mode.", expected: "exit",
        hint: "One word takes you up one level from line config mode." },
      { instruction: "Encrypt all plaintext passwords.", expected: "service password-encryption",
        hint: "One command, entered in global configuration mode, encrypts every plaintext password at once." },
      { instruction: "Create a MOTD banner using # as delimiter. Message must read: Warning! Authorized access only!", expected: "banner motd #Warning! Authorized access only!#",
        hint: "banner motd <delimiter><text><same delimiter> — include the # delimiters and the exact message, including punctuation." }
    ]
  },
  {
    id: "c1_syn_2.5_save_configurations",
    moduleLabel: "Course 1 · SyntxChk · 2.5 — Save Configurations (extended practice)",
    status: "available",
    steps: [
      { instruction: "Enter privileged EXEC mode.", expected: "enable",
        hint: "From user EXEC mode (prompt ends with >), one command takes you to privileged EXEC mode." },
      { instruction: "Display the current running configuration.", expected: "show running-config",
        hint: "show running-config — displays the configuration currently active in RAM." },
      { instruction: "Display the startup configuration saved in NVRAM.", expected: "show startup-config",
        hint: "show startup-config — since nothing has been saved yet, this should indicate no startup-config is present." },
      { instruction: "Save the running configuration to NVRAM using the copy command.", expected: "copy running-config startup-config",
        hint: "copy running-config startup-config — copies RAM's active config into NVRAM so it survives a reboot." },
      { instruction: "Accept the default destination filename by pressing Enter (leave blank and submit).", expected: "",
        hint: "Real IOS shows Destination filename [startup-config]? — press Enter with nothing typed to accept the default." },
      { instruction: "Confirm the save worked by displaying the startup configuration again.", expected: "show startup-config",
        hint: "show startup-config — it should now match what you saw in running-config." },
      { instruction: "Begin erasing the startup configuration using the erase command.", expected: "erase startup-config",
        hint: "erase startup-config — deletes the saved NVRAM configuration." },
      { instruction: "Confirm the erase by pressing Enter (accept the default).", expected: "",
        hint: "Real IOS shows Continue? [confirm] — press Enter with nothing typed to confirm." },
      { instruction: "Reboot the device using the reload command.", expected: "reload",
        hint: "reload — reboots the device, loading whatever is saved in startup-config." },
      { instruction: "You have unsaved running-config changes (like hostname or interface settings from earlier in this session). Choose not to save them: type no.", expected: "no",
        hint: "Real IOS asks: System configuration has been modified. Save? [yes/no]: — type no to discard the running-config changes and boot from the (now erased) startup-config." },
      { instruction: "Confirm the reload by pressing Enter (accept the default).", expected: "",
        hint: "Real IOS shows Proceed with reload? [confirm] — press Enter with nothing typed to confirm." }
    ]
  },
  {
    id: "c1_syn_2.7_configure_ip_addressing",
    deviceType: "switch", // used to warn if Free Practice left the shared device as a router
    moduleLabel: "Course 1 · SyntxChk · 2.7 — Configure a Switch Virtual Interface",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enter interface configuration mode for VLAN 1.", expected: "interface vlan 1",
        hint: "Three words: interface, vlan, then the number 1. VLAN 1 is the default management SVI on a switch." },
      { instruction: "Assign IPv4 address 192.168.1.20 with mask 255.255.255.0.", expected: "ip address 192.168.1.20 255.255.255.0",
        hint: "ip address <ip-address> <subnet-mask>." },
      { instruction: "Enable the interface with no shutdown.", expected: "no shutdown",
        hint: "Interfaces are administratively down by default — this brings it up." }
    ]
  },
  {
    id: "c1_syn_2.8_verify_connectivity",
    deviceType: "switch", // used to warn if Free Practice left the shared device as a router
    moduleLabel: "Course 1 · SyntxChk · 2.8 — Verify Connectivity (extended practice)",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enter interface configuration mode for VLAN 1.", expected: "interface vlan 1",
        hint: "Three words: interface, vlan, then the number 1. VLAN 1 is the default management SVI on a switch." },
      { instruction: "Assign IPv4 address 192.168.1.20 with mask 255.255.255.0.", expected: "ip address 192.168.1.20 255.255.255.0",
        hint: "ip address <ip-address> <subnet-mask> — this is the address the ping step later will send from." },
      { instruction: "Enable the interface with no shutdown.", expected: "no shutdown",
        hint: "Interfaces are administratively down by default — this brings it up, which is required for the ping to succeed." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify your interface is up with an IP address using show ip interface brief.", expected: "show ip interface brief",
        hint: "Displays a summary table of every interface's IP address and status." },
      { instruction: "Test connectivity to the neighboring switch at 192.168.1.1 using the ping command.", expected: "ping 192.168.1.1",
        hint: "ping <ip-address> — sends ICMP echo requests to test Layer 3 reachability. Now that VLAN 1 is addressed and up, this should succeed." }
    ]
  },
  {
    id: "c1_syn_10.1_configure_initial_router_settings",
    moduleLabel: "Course 1 · SyntxChk · 10.1 — Configure Initial Router Settings",
    status: "available",
    steps: [
      { instruction: "Enter privileged EXEC mode.", expected: "enable",
        hint: "One command takes you from user EXEC to privileged EXEC mode." },
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Set the hostname to R1.", expected: "hostname R1",
        hint: "hostname <name> — the prompt changes immediately." },
      { instruction: "Disable DNS lookup to prevent delays on mistyped commands.", expected: "no ip domain-lookup",
        hint: "Without this, a mistyped command gets interpreted as a hostname and causes a long DNS timeout delay." },
      { instruction: "Set the privileged EXEC enable secret to class.", expected: "enable secret class",
        hint: "enable secret <password> — this MD5-hashed secret protects privileged EXEC access." },
      { instruction: "Enter console line 0 configuration mode.", expected: "line console 0",
        hint: "Three words: line, console, then the line number 0." },
      { instruction: "Set the console password to cisco.", expected: "password cisco",
        hint: "password <password>." },
      { instruction: "Enable login on the console line.", expected: "login",
        hint: "One word — requires the password on console connection." },
      { instruction: "Enable logging synchronous to prevent log messages from interrupting typed commands.", expected: "logging synchronous",
        hint: "Two words — keeps the prompt clean when syslog messages appear while you're typing." },
      { instruction: "Set idle timeout to 0 minutes 0 seconds (never time out, for this lab).", expected: "exec-timeout 0 0",
        hint: "exec-timeout <minutes> <seconds> — 0 0 disables the timeout." },
      { instruction: "Return to global configuration mode.", expected: "exit",
        hint: "One word takes you up one level from line config mode." },
      { instruction: "Enter VTY lines 0 through 4 (routers have 5 VTY lines, unlike a switch's 16).", expected: "line vty 0 4",
        hint: "Like line console 0, but 'vty' instead of 'console', with a range 0 4." },
      { instruction: "Set the VTY password to cisco.", expected: "password cisco",
        hint: "Same command as on the console line." },
      { instruction: "Enable login on the VTY lines.", expected: "login",
        hint: "Same command as on the console line." },
      { instruction: "Enable logging synchronous on the VTY lines too.", expected: "logging synchronous",
        hint: "Same command as on the console line." },
      { instruction: "Set idle timeout to 0 minutes 0 seconds on the VTY lines too.", expected: "exec-timeout 0 0",
        hint: "Same command as on the console line." },
      { instruction: "Return to global configuration mode.", expected: "exit",
        hint: "One word takes you up one level from line config mode." },
      { instruction: "Encrypt all plaintext passwords.", expected: "service password-encryption",
        hint: "One command, entered in global configuration mode, encrypts every plaintext password at once." },
      { instruction: "Create a MOTD banner using # as delimiter. Message must read: Authorized Access Only!", expected: "banner motd #Authorized Access Only!#",
        hint: "banner motd <delimiter><text><same delimiter> — include the # delimiters and the exact message." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Save the configuration to NVRAM.", expected: "copy running-config startup-config",
        hint: "Saves the running configuration so it survives a reload." },
      { instruction: "Accept the default destination filename by pressing Enter (leave blank and submit).", expected: "",
        hint: "Real IOS shows Destination filename [startup-config]? — press Enter with nothing typed to accept the default." }
    ]
  },
  {
    id: "c1_syn_10.2_configure_router_interfaces",
    moduleLabel: "Course 1 · SyntxChk · 10.2 — Configure Router Interfaces",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enter interface GigabitEthernet 0/0/0 configuration mode.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port> — a space between the type name and the numbering is accepted, same as real IOS." },
      { instruction: "Assign IP address 192.168.10.1 mask 255.255.255.0.", expected: "ip address 192.168.10.1 255.255.255.0",
        hint: "ip address <ip-address> <subnet-mask>." },
      { instruction: "Add a description: Link to LAN 1.", expected: "description Link to LAN 1",
        hint: "description <text> — documents the purpose of the interface, shown in show running-config." },
      { instruction: "Enable the interface with no shutdown.", expected: "no shutdown",
        hint: "Interfaces are administratively down by default — this brings it up. On a physical interface, expect two status lines (LINK and LINEPROTO), not just one." },
      { instruction: "Enter interface GigabitEthernet 0/0/1 configuration mode.", expected: "interface GigabitEthernet 0/0/1",
        hint: "Same as before, with port 0/0/1 instead of 0/0/0. You can jump straight there without exiting the current interface first." },
      { instruction: "Assign IP address 192.168.11.1 mask 255.255.255.0.", expected: "ip address 192.168.11.1 255.255.255.0",
        hint: "ip address <ip-address> <subnet-mask>." },
      { instruction: "Add a description: Link to LAN 2.", expected: "description Link to LAN 2",
        hint: "description <text>." },
      { instruction: "Enable the interface with no shutdown.", expected: "no shutdown",
        hint: "Same command as on the first interface." },
      { instruction: "Return to privileged EXEC mode using end.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify interface status with show ip interface brief.", expected: "show ip interface brief",
        hint: "Displays a summary table of every interface's IP address, OK/method status, and up/down state." }
    ]
  },
  {
    id: "c1_syn_12.6_configure_ipv6_addressing",
    moduleLabel: "Course 1 · SyntxChk · 12.6 — Configure IPv6 Addressing",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enable IPv6 unicast routing on the router.", expected: "ipv6 unicast-routing",
        hint: "IPv6 routing is disabled by default and must be explicitly enabled." },
      { instruction: "Enter interface GigabitEthernet 0/0/0 configuration mode.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port> — a space between the type name and the numbering is accepted." },
      { instruction: "Assign the IPv6 address 2001:db8:acad:1::1/64.", expected: "ipv6 address 2001:db8:acad:1::1/64",
        hint: "ipv6 address <address>/<prefix-length> — /64 is the standard prefix length for an IPv6 LAN segment." },
      { instruction: "Assign a link-local address fe80::1:1.", expected: "ipv6 address fe80::1:1 link-local",
        hint: "Link-local addresses (fe80::/10) are used for on-link communication only, and have no /prefix on this command." },
      { instruction: "Enable the interface.", expected: "no shutdown",
        hint: "Interfaces are administratively down by default." },
      { instruction: "Enter interface GigabitEthernet 0/0/1 configuration mode.", expected: "interface GigabitEthernet 0/0/1",
        hint: "You can jump straight there without exiting the current interface first." },
      { instruction: "Assign the IPv6 address 2001:db8:acad:2::1/64.", expected: "ipv6 address 2001:db8:acad:2::1/64",
        hint: "Each subnet gets a unique /64 prefix." },
      { instruction: "Assign a link-local address fe80::2:1.", expected: "ipv6 address fe80::2:1 link-local",
        hint: "Same command as on the first interface, with a different link-local address." },
      { instruction: "Enable the interface.", expected: "no shutdown",
        hint: "Both interfaces now have IPv6 addresses." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify with show ipv6 interface brief.", expected: "show ipv6 interface brief",
        hint: "Shows IPv6 address assignments and interface status." }
    ]
  },
  {
    id: "c1_syn_16.4_configure_secure_passwords_and_ssh",
    moduleLabel: "Course 1 · SyntxChk · 16.4 — Configure Secure Passwords and SSH",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Set a minimum password length of 10 characters.", expected: "security passwords min-length 10",
        hint: "Passwords shorter than 10 characters will be rejected once this is set." },
      { instruction: "Set the enable secret to class12345.", expected: "enable secret class12345",
        hint: "enable secret <password> — meets the 10-character minimum requirement." },
      { instruction: "Set the domain name to cisco.com.", expected: "ip domain-name cisco.com",
        hint: "A domain name is required before generating RSA keys." },
      { instruction: "Create local user admin with secret cisco12345.", expected: "username admin secret cisco12345",
        hint: "username <name> secret <password> — this account will be used for SSH login." },
      { instruction: "Generate RSA keys with modulus size 1024.", expected: "crypto key generate rsa modulus 1024",
        hint: "crypto key generate rsa modulus <bits> — this is what actually enables SSH on the device." },
      { instruction: "Set SSH to version 2 only.", expected: "ip ssh version 2",
        hint: "SSHv2 is more secure than SSHv1." },
      { instruction: "Enter VTY line configuration for lines 0 through 4.", expected: "line vty 0 4",
        hint: "Like line console 0, but 'vty' instead of 'console', with a range 0 4." },
      { instruction: "Set VTY login to use the local username database.", expected: "login local",
        hint: "login local requires a username/password from the local database, not a single shared line password." },
      { instruction: "Restrict VTY to SSH only — disable Telnet.", expected: "transport input ssh",
        hint: "transport input ssh — only SSH connections will be accepted on this line." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Save the configuration to NVRAM.", expected: "copy running-config startup-config",
        hint: "Saves the running configuration so it survives a reload." },
      { instruction: "Accept the default destination filename by pressing Enter (leave blank and submit).", expected: "",
        hint: "Real IOS shows Destination filename [startup-config]? — press Enter with nothing typed to accept the default." }
    ]
  },
  {
    id: "c1_syn_17.5_verify_directly_connected_networks",
    moduleLabel: "Course 1 · SyntxChk · 17.5 — Verify Directly Connected Networks",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enter interface GigabitEthernet 0/0/0 configuration mode.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port> — a space between the type name and the numbering is accepted." },
      { instruction: "Assign IP address 192.168.10.1 mask 255.255.255.0.", expected: "ip address 192.168.10.1 255.255.255.0",
        hint: "ip address <ip-address> <subnet-mask>." },
      { instruction: "Add a description: Link to LAN 1.", expected: "description Link to LAN 1",
        hint: "description <text>." },
      { instruction: "Enable the interface with no shutdown.", expected: "no shutdown",
        hint: "Interfaces are administratively down by default." },
      { instruction: "Enter interface GigabitEthernet 0/0/1 configuration mode.", expected: "interface GigabitEthernet 0/0/1",
        hint: "You can jump straight there without exiting the current interface first." },
      { instruction: "Assign IP address 192.168.11.1 mask 255.255.255.0.", expected: "ip address 192.168.11.1 255.255.255.0",
        hint: "ip address <ip-address> <subnet-mask>." },
      { instruction: "Add a description: Link to LAN 2.", expected: "description Link to LAN 2",
        hint: "description <text>." },
      { instruction: "Enable the interface with no shutdown.", expected: "no shutdown",
        hint: "Same command as on the first interface." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify all interface IP addresses and status with show ip interface brief.", expected: "show ip interface brief",
        hint: "This is the most used verification command — shows all interfaces at a glance." },
      { instruction: "View detailed status of GigabitEthernet 0/0/0 using show interfaces GigabitEthernet 0/0/0.", expected: "show interfaces GigabitEthernet 0/0/0",
        hint: "Shows full detail: errors, bandwidth, MTU, duplex, speed — much more than show ip interface brief." },
      { instruction: "View the IP routing table using show ip route.", expected: "show ip route",
        hint: "The routing table shows all networks the router knows how to reach — right now, just the directly connected ones." },
      { instruction: "View the running configuration with show running-config.", expected: "show running-config",
        hint: "Shows the complete active configuration in RAM." }
    ]
  },
  {
    id: "c2_syn_1.1_configure_ssh_on_a_switch",
    deviceType: "switch", // used to warn if Free Practice left the shared device as a router
    moduleLabel: "Course 2 · SyntxChk · 1.1 — Configure SSH on a Switch",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Set the domain name to cisco.com.", expected: "ip domain-name cisco.com",
        hint: "A domain name is required before generating RSA keys for SSH." },
      { instruction: "Create local user admin with secret ccna.", expected: "username admin secret ccna",
        hint: "username <name> secret <password> — used for SSH authentication." },
      { instruction: "Generate RSA keys with modulus 1024.", expected: "crypto key generate rsa modulus 1024",
        hint: "crypto key generate rsa modulus <bits> — this is what actually enables SSH." },
      { instruction: "Set SSH to version 2.", expected: "ip ssh version 2",
        hint: "SSHv2 is more secure than SSHv1, which has known vulnerabilities." },
      { instruction: "Enter VTY lines 0 through 15.", expected: "line vty 0 15",
        hint: "Switches have 16 VTY lines (0-15), unlike a router's 5 (0-4)." },
      { instruction: "Set VTY login to use the local username database.", expected: "login local",
        hint: "login local requires the username/password created earlier, not a single shared line password." },
      { instruction: "Allow only SSH on VTY lines — disable Telnet.", expected: "transport input ssh",
        hint: "Telnet sends data in plaintext; SSH encrypts all traffic." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify SSH configuration with show ip ssh.", expected: "show ip ssh",
        hint: "Confirms SSH version, timeout, and authentication retries." }
    ]
  },
  {
    id: "c2_syn_1.2_configure_router_interfaces",
    moduleLabel: "Course 2 · SyntxChk · 1.2 — Configure Router Interfaces",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enter interface GigabitEthernet 0/0/0.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port> — a space between the type name and the numbering is accepted." },
      { instruction: "Assign IP address 10.0.0.1 mask 255.255.255.0.", expected: "ip address 10.0.0.1 255.255.255.0",
        hint: "ip address <ip-address> <subnet-mask>." },
      { instruction: "Add description Link to S1.", expected: "description Link to S1",
        hint: "description <text> — always document interfaces with meaningful descriptions." },
      { instruction: "Enable the interface.", expected: "no shutdown",
        hint: "Interfaces are administratively down by default. On a physical interface, expect two status lines (LINK and LINEPROTO)." },
      { instruction: "Enter interface GigabitEthernet 0/0/1.", expected: "interface GigabitEthernet 0/0/1",
        hint: "You can jump straight there without exiting the current interface first." },
      { instruction: "Assign IP address 10.0.1.1 mask 255.255.255.0.", expected: "ip address 10.0.1.1 255.255.255.0",
        hint: "ip address <ip-address> <subnet-mask>." },
      { instruction: "Add description Link to S2.", expected: "description Link to S2",
        hint: "description <text>." },
      { instruction: "Enable the interface.", expected: "no shutdown",
        hint: "Same command as on the first interface. Both router interfaces will now be up." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify with show ip interface brief.", expected: "show ip interface brief",
        hint: "Both interfaces should show up/up with their IP addresses." }
    ]
  },
  {
    id: "c2_syn_1.3_secure_remote_access_switch",
    deviceType: "switch", // used to warn if Free Practice left the shared device as a router
    moduleLabel: "Course 2 · SyntxChk · 1.3 — Secure Remote Access (Switch)",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Block logins for 120 seconds after 3 failed attempts within 60 seconds.", expected: "login block-for 120 attempts 3 within 60",
        hint: "login block-for <seconds> attempts <n> within <seconds> — protects against brute-force login attacks." },
      { instruction: "Set minimum password length to 8 characters.", expected: "security passwords min-length 8",
        hint: "security passwords min-length <n> — weak passwords are rejected at configuration time." },
      { instruction: "Set the enable secret to class12345.", expected: "enable secret class12345",
        hint: "enable secret <password> — MD5-hashed, more secure than enable password." },
      { instruction: "Set the domain name to ccna-lab.com.", expected: "ip domain-name ccna-lab.com",
        hint: "Required for RSA key generation." },
      { instruction: "Create local user netadmin with privilege 15 and secret Cisco_CCNA7.", expected: "username netadmin privilege 15 secret Cisco_CCNA7",
        hint: "username <name> privilege <level> secret <password> — privilege 15 gives full access." },
      { instruction: "Generate RSA keys with modulus 1024.", expected: "crypto key generate rsa modulus 1024",
        hint: "crypto key generate rsa modulus <bits> — this is what actually enables SSH." },
      { instruction: "Set SSH version to 2.", expected: "ip ssh version 2",
        hint: "SSHv2 is more secure than SSHv1." },
      { instruction: "Set SSH authentication timeout to 90 seconds.", expected: "ip ssh time-out 90",
        hint: "ip ssh time-out <seconds> — limits time allowed for SSH session establishment." },
      { instruction: "Limit SSH to 2 authentication retries.", expected: "ip ssh authentication-retries 2",
        hint: "After 2 failed attempts the SSH session disconnects." },
      { instruction: "Enter VTY lines 0 through 15.", expected: "line vty 0 15",
        hint: "Switches have 16 VTY lines (0-15)." },
      { instruction: "Set VTY login to use the local user database.", expected: "login local",
        hint: "login local requires a username/password from the local database." },
      { instruction: "Allow only SSH on VTY lines.", expected: "transport input ssh",
        hint: "Telnet is disabled once this is set." },
      { instruction: "Set exec timeout to 5 minutes 0 seconds.", expected: "exec-timeout 5 0",
        hint: "exec-timeout <minutes> <seconds> — idle sessions disconnect after this long." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." }
    ]
  },
  {
    id: "c2_syn_3.2_configure_vlans",
    deviceType: "switch", // used to warn if Free Practice left the shared device as a router
    moduleLabel: "Course 2 · SyntxChk · 3.2 — Configure VLANs on a Switch",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Create VLAN 10.", expected: "vlan 10",
        hint: "vlan <id> — creates the VLAN and enters VLAN configuration mode." },
      { instruction: "Name VLAN 10 Faculty.", expected: "name Faculty",
        hint: "name <name> — naming VLANs makes the network easier to manage." },
      { instruction: "Create VLAN 20.", expected: "vlan 20",
        hint: "You can jump straight to another VLAN without exiting first." },
      { instruction: "Name VLAN 20 Students.", expected: "name Students",
        hint: "name <name>." },
      { instruction: "Create VLAN 30.", expected: "vlan 30",
        hint: "vlan <id>." },
      { instruction: "Name VLAN 30 Guest.", expected: "name Guest",
        hint: "name <name>." },
      { instruction: "Return to global configuration mode.", expected: "exit",
        hint: "One word takes you up one level from VLAN config mode." },
      { instruction: "Enter interface FastEthernet 0/6.", expected: "interface FastEthernet 0/6",
        hint: "This port will be assigned to VLAN 10." },
      { instruction: "Set the port to access mode.", expected: "switchport mode access",
        hint: "Access mode is used for end devices — one VLAN per port." },
      { instruction: "Assign this port to VLAN 10.", expected: "switchport access vlan 10",
        hint: "switchport access vlan <id> — this port now belongs to the Faculty VLAN." },
      { instruction: "Enter interface FastEthernet 0/11.", expected: "interface FastEthernet 0/11",
        hint: "This port will be assigned to VLAN 20." },
      { instruction: "Set the port to access mode.", expected: "switchport mode access",
        hint: "Same command as on the previous port." },
      { instruction: "Assign this port to VLAN 20.", expected: "switchport access vlan 20",
        hint: "switchport access vlan <id> — this port now belongs to the Students VLAN." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify with show vlan brief.", expected: "show vlan brief",
        hint: "Shows all VLANs and the access ports assigned to each." }
    ]
  },
  {
    id: "c2_syn_3.3_configure_trunk_links",
    deviceType: "switch", // used to warn if Free Practice left the shared device as a router
    moduleLabel: "Course 2 · SyntxChk · 3.3 — Configure 802.1Q Trunk Links",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Create VLAN 10.", expected: "vlan 10",
        hint: "This exercise stands on its own — if you already created these VLANs in 3.2, that's fine, this just makes sure they're here regardless." },
      { instruction: "Name VLAN 10 Faculty.", expected: "name Faculty",
        hint: "Same name used in 3.2, so the two exercises stay consistent." },
      { instruction: "Create VLAN 20.", expected: "vlan 20",
        hint: "You can jump straight to another VLAN without exiting first." },
      { instruction: "Name VLAN 20 Students.", expected: "name Students",
        hint: "Same name used in 3.2." },
      { instruction: "Create VLAN 30.", expected: "vlan 30",
        hint: "vlan <id>." },
      { instruction: "Name VLAN 30 Guest.", expected: "name Guest",
        hint: "Same name used in 3.2." },
      { instruction: "Create VLAN 99 — this will be the native (management) VLAN for the trunk.", expected: "vlan 99",
        hint: "VLAN 99 wasn't part of 3.2 — it's specific to configuring the trunk's native VLAN." },
      { instruction: "Name VLAN 99 Management.", expected: "name Management",
        hint: "name <name>." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Confirm all four VLANs exist with show vlan brief — these are the same VLANs 3.2 created, if you did that exercise first.", expected: "show vlan brief",
        hint: "Shows all VLANs and their assigned ports — VLANs 10, 20, 30, and 99 should all appear here now." },
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enter interface FastEthernet 0/1 — the uplink port to the router.", expected: "interface FastEthernet 0/1",
        hint: "This port connects to the router for inter-VLAN routing." },
      { instruction: "Set this port to trunk mode.", expected: "switchport mode trunk",
        hint: "Trunk mode allows multiple VLANs on a single link. Expect the line protocol to flap down then up." },
      { instruction: "Set the native VLAN to 99.", expected: "switchport trunk native vlan 99",
        hint: "The native VLAN carries untagged traffic and must match on both ends of the trunk." },
      { instruction: "Allow only VLANs 10, 20, 30, and 99 on this trunk.", expected: "switchport trunk allowed vlan 10,20,30,99",
        hint: "Best practice: only allow VLANs that actually need to traverse the trunk. No spaces after the commas." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify trunk configuration with show interfaces FastEthernet 0/1 trunk.", expected: "show interfaces FastEthernet 0/1 trunk",
        hint: "Shows trunking mode, encapsulation, native VLAN, and allowed VLANs." }
    ]
  },
  {
    id: "c2_syn_4.2_router_on_a_stick",
    moduleLabel: "Course 2 · SyntxChk · 4.2 — Router-on-a-Stick Inter-VLAN Routing",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enter subinterface GigabitEthernet 0/0/0.10 for VLAN 10.", expected: "interface GigabitEthernet 0/0/0.10",
        hint: "The .10 extension creates subinterface 10 on the physical port." },
      { instruction: "Set encapsulation to dot1Q for VLAN 10.", expected: "encapsulation dot1Q 10",
        hint: "encapsulation dot1Q <vlan-id> — tells the router to tag traffic on this subinterface with VLAN 10." },
      { instruction: "Assign IP 172.17.10.1 mask 255.255.255.0 — the default gateway for VLAN 10 hosts.", expected: "ip address 172.17.10.1 255.255.255.0",
        hint: "Hosts in VLAN 10 will use this address as their default gateway." },
      { instruction: "Enter subinterface GigabitEthernet 0/0/0.20 for VLAN 20.", expected: "interface GigabitEthernet 0/0/0.20",
        hint: "You can jump straight to another subinterface without exiting first." },
      { instruction: "Set encapsulation to dot1Q for VLAN 20.", expected: "encapsulation dot1Q 20",
        hint: "Same command shape as before, different VLAN ID." },
      { instruction: "Assign IP 172.17.20.1 mask 255.255.255.0.", expected: "ip address 172.17.20.1 255.255.255.0",
        hint: "VLAN 20 hosts will use this as their default gateway." },
      { instruction: "Enter subinterface for VLAN 99 (native/management VLAN).", expected: "interface GigabitEthernet 0/0/0.99",
        hint: "interface <physical>.<subif-number> — the subinterface number doesn't have to match the VLAN ID, but it's common practice to keep them the same." },
      { instruction: "Set encapsulation to dot1Q for VLAN 99, marked as native.", expected: "encapsulation dot1Q 99 native",
        hint: "The native keyword marks this as the native (untagged) VLAN — it must match the switch's native VLAN configuration." },
      { instruction: "Assign IP 172.17.99.1 mask 255.255.255.0.", expected: "ip address 172.17.99.1 255.255.255.0",
        hint: "ip address <ip-address> <subnet-mask>." },
      { instruction: "Enter the physical interface — no IP goes here, only the subinterfaces carry addresses.", expected: "interface GigabitEthernet 0/0/0",
        hint: "The physical port itself stays unaddressed; it's just the trunk carrying all three VLANs' tagged traffic." },
      { instruction: "Enable the physical interface.", expected: "no shutdown",
        hint: "Bringing up the physical interface also brings up every subinterface configured under it — watch for multiple status messages." },
      { instruction: "Return to privileged EXEC mode and verify.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify subinterfaces with show ip interface brief.", expected: "show ip interface brief",
        hint: "All three subinterfaces should show up/up with their assigned IP addresses." }
    ]
  },
  {
    id: "c2_syn_7.1_configure_dhcpv4",
    moduleLabel: "Course 2 · SyntxChk · 7.1 — Configure DHCPv4",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Exclude 192.168.10.1 through 192.168.10.9 from DHCP assignment (already used by devices).", expected: "ip dhcp excluded-address 192.168.10.1 192.168.10.9",
        hint: "ip dhcp excluded-address <start> <end> — this is a global command, not inside a pool." },
      { instruction: "Create a DHCP pool named LAN-POOL-1.", expected: "ip dhcp pool LAN-POOL-1",
        hint: "ip dhcp pool <name> — enters DHCP pool configuration mode, prompt changes to (dhcp-config)#." },
      { instruction: "Set the network this pool serves to 192.168.10.0/24.", expected: "network 192.168.10.0 255.255.255.0",
        hint: "network <network> <mask> — defines the full range DHCP will hand out from (before exclusions)." },
      { instruction: "Set the default gateway to 192.168.10.1 — the router's own interface on this network.", expected: "default-router 192.168.10.1",
        hint: "default-router <ip-address> — usually the router's own interface address on this network." },
      { instruction: "Set the DNS server to 192.168.10.1.", expected: "dns-server 192.168.10.1",
        hint: "dns-server <ip-address>." },
      { instruction: "Set the domain name to ccna-lab.com.", expected: "domain-name ccna-lab.com",
        hint: "domain-name <name> — note this is different from \"ip domain-name\", which is a separate global command used for SSH." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify the pool with show ip dhcp pool.", expected: "show ip dhcp pool",
        hint: "Shows total/leased/excluded address counts and the pool's address range." }
    ]
  },
  {
    id: "c2_syn_7.2_configure_dhcp_relay",
    moduleLabel: "Course 2 · SyntxChk · 7.2 — Configure a DHCP Relay Agent",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enter interface GigabitEthernet 0/0/0 — the interface facing the clients.", expected: "interface GigabitEthernet 0/0/0",
        hint: "This is the client-facing interface that will relay DHCP requests." },
      { instruction: "Assign IP address 192.168.10.1 mask 255.255.255.0 to this interface.", expected: "ip address 192.168.10.1 255.255.255.0",
        hint: "ip address <ip-address> <subnet-mask> — the interface needs a real address for this verification to look realistic." },
      { instruction: "Enable the interface.", expected: "no shutdown",
        hint: "Interfaces are administratively down by default." },
      { instruction: "Configure the DHCP relay agent pointing to a server at 192.168.11.5.", expected: "ip helper-address 192.168.11.5",
        hint: "ip helper-address <ip-address> — DHCP broadcasts from clients get forwarded here as unicast." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify the helper address is configured.", expected: "show ip interface GigabitEthernet 0/0/0",
        hint: "show ip interface <name> — a longer, IP-specific detail report; look for the \"Helper address is ...\" line." }
    ]
  },
  {
    id: "c2_syn_8.2_configure_stateless_dhcpv6",
    moduleLabel: "Course 2 · SyntxChk · 8.2 — Configure Stateless DHCPv6",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enable IPv6 unicast routing.", expected: "ipv6 unicast-routing",
        hint: "Must be enabled for the router to forward IPv6 packets at all." },
      { instruction: "Create a DHCPv6 pool named R1-STATELESS.", expected: "ipv6 dhcp pool R1-STATELESS",
        hint: "ipv6 dhcp pool <name> — enters DHCPv6 pool configuration mode, prompt changes to (config-dhcpv6)#." },
      { instruction: "Set the DNS server to 2001:db8:acad::254.", expected: "dns-server 2001:db8:acad::254",
        hint: "In stateless mode, DHCPv6 provides DNS/domain info but NOT the address itself — hosts build their own via SLAAC." },
      { instruction: "Set the domain name to stateless.com.", expected: "domain-name stateless.com",
        hint: "domain-name <name>." },
      { instruction: "Return to global configuration mode.", expected: "exit",
        hint: "One word takes you up one level from DHCPv6 pool config mode." },
      { instruction: "Enter interface GigabitEthernet 0/0/0.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port>." },
      { instruction: "Assign IPv6 address 2001:db8:acad:1::1/64.", expected: "ipv6 address 2001:db8:acad:1::1/64",
        hint: "The router advertises this prefix so hosts can build their own address via SLAAC." },
      { instruction: "Set the Other config flag — tells hosts to get DNS/domain info from DHCPv6.", expected: "ipv6 nd other-config-flag",
        hint: "The O-flag: use SLAAC for the address itself, but ask DHCPv6 for everything else." },
      { instruction: "Bind the DHCPv6 pool to this interface.", expected: "ipv6 dhcp server R1-STATELESS",
        hint: "ipv6 dhcp server <pool-name> — this interface will now answer DHCPv6 requests from clients." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." }
    ]
  },
  {
    id: "c2_syn_8.3_configure_stateful_dhcpv6",
    moduleLabel: "Course 2 · SyntxChk · 8.3 — Configure Stateful DHCPv6",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enable IPv6 unicast routing.", expected: "ipv6 unicast-routing",
        hint: "Must be enabled for the router to forward IPv6 packets at all." },
      { instruction: "Create a DHCPv6 pool named R1-STATEFUL.", expected: "ipv6 dhcp pool R1-STATEFUL",
        hint: "ipv6 dhcp pool <name> — enters DHCPv6 pool configuration mode." },
      { instruction: "Define the address prefix for assignment: 2001:db8:acad:1::/64.", expected: "address prefix 2001:db8:acad:1::/64",
        hint: "address prefix <ipv6-prefix>/<length> — unlike stateless, DHCPv6 itself assigns the full address from this range." },
      { instruction: "Set the DNS server to 2001:4860:4860::8888.", expected: "dns-server 2001:4860:4860::8888",
        hint: "This is one of Google's public IPv6 DNS servers." },
      { instruction: "Set the domain name to stateful.com.", expected: "domain-name stateful.com",
        hint: "domain-name <name>." },
      { instruction: "Return to global configuration mode.", expected: "exit",
        hint: "One word takes you up one level from DHCPv6 pool config mode." },
      { instruction: "Enter interface GigabitEthernet 0/0/0.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port>." },
      { instruction: "Assign IPv6 address 2001:db8:acad:1::1/64.", expected: "ipv6 address 2001:db8:acad:1::1/64",
        hint: "ipv6 address <address>/<prefix-length>." },
      { instruction: "Set the Managed config flag — tells hosts to get their full address from DHCPv6.", expected: "ipv6 nd managed-config-flag",
        hint: "The M-flag: don't use SLAAC at all, get your complete IPv6 address from DHCPv6 instead." },
      { instruction: "Bind the DHCPv6 pool to this interface.", expected: "ipv6 dhcp server R1-STATEFUL",
        hint: "ipv6 dhcp server <pool-name> — this interface will now respond to DHCPv6 Solicit messages." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." }
    ]
  },
  {
    id: "c2_syn_11.1_configure_port_security",
    deviceType: "switch", // used to warn if Free Practice left the shared device as a router
    moduleLabel: "Course 2 · SyntxChk · 11.1 — Configure Port Security",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enter interface FastEthernet 0/1.", expected: "interface FastEthernet 0/1",
        hint: "interface <type> <slot/port>." },
      { instruction: "Set the port to access mode. Port security requires access mode.", expected: "switchport mode access",
        hint: "Port security only works on access ports, not trunk ports." },
      { instruction: "Enable port security on this interface.", expected: "switchport port-security",
        hint: "Port security is now active with default settings (max 1 MAC)." },
      { instruction: "Set the maximum number of allowed MAC addresses to 2.", expected: "switchport port-security maximum 2",
        hint: "switchport port-security maximum <n> — up to 2 different MAC addresses can use this port." },
      { instruction: "Set the violation mode to restrict. This drops unauthorized traffic and logs violations.", expected: "switchport port-security violation restrict",
        hint: "restrict mode: drops bad traffic, increments violation counter, sends syslog (unlike shutdown, which disables the port)." },
      { instruction: "Configure port security to learn and remember MAC addresses automatically.", expected: "switchport port-security mac-address sticky",
        hint: "Sticky learning remembers connected MAC addresses and saves them to the configuration." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify port security configuration with show port-security interface FastEthernet 0/1.", expected: "show port-security interface FastEthernet 0/1",
        hint: "Shows security settings, violation mode, and learned MAC addresses." }
    ]
  },
  {
    id: "c2_syn_14.3_basic_router_config_review",
    moduleLabel: "Course 2 · SyntxChk · 14.3 — Basic Router Configuration Review",
    status: "available",
    precondition: "This lab assumes the device is already in user EXEC mode. If yours isn't, reset the device first.",
    steps: [
      { instruction: "Enter privileged EXEC mode.", expected: "enable",
        hint: "The very first step from user EXEC mode." },
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Set the hostname to R1.", expected: "hostname R1",
        hint: "hostname <name>." },
      { instruction: "Disable DNS lookup.", expected: "no ip domain-lookup",
        hint: "Prevents long delays when a command is mistyped and the router tries to resolve it as a hostname." },
      { instruction: "Set enable secret to class.", expected: "enable secret class",
        hint: "enable secret <password> — MD5-hashed, more secure than enable password." },
      { instruction: "Encrypt all plaintext passwords.", expected: "service password-encryption",
        hint: "One command, encrypts every plaintext password currently configured." },
      { instruction: "Set the MOTD banner with message: Authorized Access Only", expected: "banner motd #Authorized Access Only#",
        hint: "banner motd <delimiter><message><delimiter> — any character not in the message works as the delimiter." },
      { instruction: "Enter interface GigabitEthernet 0/0/0.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port>." },
      { instruction: "Assign IP 209.165.200.225 mask 255.255.255.252.", expected: "ip address 209.165.200.225 255.255.255.252",
        hint: "A /30 mask — commonly used for point-to-point WAN links, since it only needs 2 usable addresses." },
      { instruction: "Add description Link to ISP.", expected: "description Link to ISP",
        hint: "description <text>." },
      { instruction: "Enable the interface.", expected: "no shutdown",
        hint: "Interfaces are administratively down by default." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Save the configuration.", expected: "copy running-config startup-config",
        hint: "copy running-config startup-config, then press Enter to accept the default filename." }
    ]
  },
  {
    id: "c2_syn_15.4_configure_ip_static_routes",
    moduleLabel: "Course 2 · SyntxChk · 15.4 — Configure IP Static Routes",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Add a static route to network 172.16.1.0/24 via next-hop 172.16.2.2.", expected: "ip route 172.16.1.0 255.255.255.0 172.16.2.2",
        hint: "ip route <network> <mask> <next-hop> — packets to that network will be forwarded to the next-hop address." },
      { instruction: "Add a static route to network 192.168.1.0/24 via next-hop 172.16.2.2.", expected: "ip route 192.168.1.0 255.255.255.0 172.16.2.2",
        hint: "Same command shape, different destination network." },
      { instruction: "Add a default static route (gateway of last resort) via 172.16.2.2.", expected: "ip route 0.0.0.0 0.0.0.0 172.16.2.2",
        hint: "ip route 0.0.0.0 0.0.0.0 <next-hop> — the default route matches any destination not otherwise in the routing table." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify the routing table with show ip route.", expected: "show ip route",
        hint: "S entries are static routes. S* marks the default route (candidate default)." }
    ]
  },
  {
    id: "c2_syn_16.2_configure_floating_static_routes",
    moduleLabel: "Course 2 · SyntxChk · 16.2 — Configure Floating Static Routes",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Add the primary default route via 172.16.2.2 (AD=1, the default).", expected: "ip route 0.0.0.0 0.0.0.0 172.16.2.2",
        hint: "The default administrative distance for a static route is 1 — no need to type it explicitly." },
      { instruction: "Add a floating (backup) default route via 10.10.10.2 with AD of 5.", expected: "ip route 0.0.0.0 0.0.0.0 10.10.10.2 5",
        hint: "ip route <network> <mask> <next-hop> <AD> — a higher AD means this route is only used if the primary (lower-AD) route is unavailable." },
      { instruction: "Add a primary static route to 192.168.10.0/24 via 172.16.2.2.", expected: "ip route 192.168.10.0 255.255.255.0 172.16.2.2",
        hint: "Same shape as the earlier default route, different destination network, still default AD=1." },
      { instruction: "Add a floating backup route to 192.168.10.0/24 via 10.10.10.2 with AD 5.", expected: "ip route 192.168.10.0 255.255.255.0 10.10.10.2 5",
        hint: "Backup route — only activates automatically if the primary route disappears." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify the routing table — only primary (AD=1) routes should appear.", expected: "show ip route",
        hint: "Floating routes stay hidden in the routing table until their lower-AD sibling is removed." }
    ]
  },
  {
    id: "c3_syn_2.1_ospfv2_point_to_point",
    moduleLabel: "Course 3 · SyntxChk · 2.1 — Configure OSPFv2 on Point-to-Point Networks",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Start OSPF process 10.", expected: "router ospf 10",
        hint: "router ospf <process-id> — the process ID is locally significant only, doesn't need to match other routers." },
      { instruction: "Set the router ID to 1.1.1.1.", expected: "router-id 1.1.1.1",
        hint: "router-id <a.b.c.d> — uniquely identifies this router in the OSPF domain." },
      { instruction: "Advertise network 10.10.1.0 with wildcard 0.0.0.255 in area 0.", expected: "network 10.10.1.0 0.0.0.255 area 0",
        hint: "Wildcard mask 0.0.0.255 = /24 — the inverse of a normal subnet mask." },
      { instruction: "Advertise network 10.10.2.0 with wildcard 0.0.0.255 in area 0.", expected: "network 10.10.2.0 0.0.0.255 area 0",
        hint: "Same shape, different network." },
      { instruction: "Advertise the loopback network 1.1.1.1 host route with wildcard 0.0.0.0 in area 0.", expected: "network 1.1.1.1 0.0.0.0 area 0",
        hint: "A wildcard of 0.0.0.0 matches this exact address only — used for loopback/host routes." },
      { instruction: "Make interface GigabitEthernet 0/0/0 passive — no OSPF hellos sent out.", expected: "passive-interface GigabitEthernet 0/0/0",
        hint: "Passive interfaces still advertise their network but never form adjacencies — typical for LAN-facing interfaces." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify OSPF neighbors.", expected: "show ip ospf neighbor",
        hint: "FULL means the neighbor relationship is complete and routes are being exchanged." },
      { instruction: "Verify OSPF routes in the routing table.", expected: "show ip route ospf",
        hint: "Shows only the O (OSPF-learned) routes, filtered from the full table — useful to confirm route propagation." }
    ]
  },
  {
    id: "c3_syn_2.3_ospfv2_multiaccess",
    moduleLabel: "Course 3 · SyntxChk · 2.3 — Configure OSPFv2 on Multiaccess Networks",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enter interface GigabitEthernet 0/0/0.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port>." },
      { instruction: "Set OSPF priority to 255 to ensure R1 becomes the DR.", expected: "ip ospf priority 255",
        hint: "Priority range is 0-255 — highest wins the DR election. 0 means this router can never be DR/BDR." },
      { instruction: "Return to global configuration mode.", expected: "exit",
        hint: "One word takes you up one level from interface config mode." },
      { instruction: "Start OSPF process 10.", expected: "router ospf 10",
        hint: "router ospf <process-id>." },
      { instruction: "Set the router ID to 1.1.1.1.", expected: "router-id 1.1.1.1",
        hint: "router-id <a.b.c.d>." },
      { instruction: "Advertise the LAN network 192.168.1.0 wildcard 0.0.0.255 area 0.", expected: "network 192.168.1.0 0.0.0.255 area 0",
        hint: "Wildcard mask 0.0.0.255 = /24." },
      { instruction: "Advertise the loopback 1.1.1.1 wildcard 0.0.0.0 area 0.", expected: "network 1.1.1.1 0.0.0.0 area 0",
        hint: "A wildcard of 0.0.0.0 matches this exact address only." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify DR/BDR election on the multiaccess segment.", expected: "show ip ospf interface GigabitEthernet 0/0/0",
        hint: "Shows DR/BDR state, priority, and hello/dead intervals — on a multiaccess network, DR/BDR election actually happens." }
    ]
  },
  {
    id: "c3_syn_2.4_modify_ospfv2",
    moduleLabel: "Course 3 · SyntxChk · 2.4 — Modify OSPFv2: Timers and Authentication",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode, with OSPF process 10 already running. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enter interface GigabitEthernet 0/0/0.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port>." },
      { instruction: "Set the OSPF hello interval to 5 seconds.", expected: "ip ospf hello-interval 5",
        hint: "Default is 10 seconds — must match the neighbor or the adjacency will fail." },
      { instruction: "Set the OSPF dead interval to 20 seconds.", expected: "ip ospf dead-interval 20",
        hint: "Default is 40 seconds (4x hello) — must match the neighbor." },
      { instruction: "Enable OSPF MD5 authentication using key 1 and password OSPF_Key.", expected: "ip ospf message-digest-key 1 md5 OSPF_Key",
        hint: "ip ospf message-digest-key <key-id> md5 <key> — the key ID and password must match on both ends." },
      { instruction: "Activate MD5 authentication on this interface.", expected: "ip ospf authentication message-digest",
        hint: "This is what actually turns authentication ON — the message-digest-key alone just defines the key." },
      { instruction: "Return to global configuration mode.", expected: "exit",
        hint: "\"router ospf\" is a global-config-mode command — you have to leave interface config mode first (real IOS rejects it directly from (config-if)#)." },
      { instruction: "Return to OSPF router config mode.", expected: "router ospf 10",
        hint: "Since process 10 already exists, this re-enters its configuration mode rather than creating a new process." },
      { instruction: "Set the reference bandwidth to 1000 Mbps, to account for gigabit and faster links.", expected: "auto-cost reference-bandwidth 1000",
        hint: "Default is 100 Mbps — set the SAME value on every router in the domain, or costs won't compare consistently." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." }
    ]
  },
  {
    id: "c3_syn_2.6_verify_ospfv2",
    moduleLabel: "Course 3 · SyntxChk · 2.6 — Verify Single-Area OSPFv2",
    status: "available",
    precondition: "This lab assumes OSPF is already configured and running on the device. If not, complete 2.1 or 2.3 first, or type enable and configure OSPF in Free Practice.",
    steps: [
      { instruction: "Verify OSPF process information.", expected: "show ip ospf",
        hint: "Shows process ID, router ID, and area info — a process-level summary." },
      { instruction: "Verify OSPF neighbor adjacencies.", expected: "show ip ospf neighbor",
        hint: "State FULL means the neighbor relationship is complete and routes are exchanged." },
      { instruction: "Verify OSPF interface details on GigabitEthernet 0/0/0.", expected: "show ip ospf interface GigabitEthernet 0/0/0",
        hint: "Shows cost, network type, DR/BDR (if applicable), and timer values for one specific interface." },
      { instruction: "Verify only OSPF routes in the routing table.", expected: "show ip route ospf",
        hint: "Filters the routing table down to just the O entries — useful to confirm which routes OSPF actually learned." },
      { instruction: "View the full routing table for a complete picture.", expected: "show ip route",
        hint: "C=connected, L=local, O=OSPF. The [110/x] notation is [administrative distance/metric]." }
    ]
  },
  {
    id: "c3_syn_5.2_standard_acls",
    moduleLabel: "Course 3 · SyntxChk · 5.2 — Configure Numbered Standard ACLs",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Create ACL 1 permitting host 192.168.10.10.", expected: "access-list 1 permit host 192.168.10.10",
        hint: "The host keyword is shorthand for wildcard 0.0.0.0 — an exact match on this one address." },
      { instruction: "Add an entry to ACL 1 permitting the entire 192.168.20.0/24 network.", expected: "access-list 1 permit 192.168.20.0 0.0.0.255",
        hint: "Wildcard 0.0.0.255 matches any host in the /24 network — the inverse of a normal subnet mask." },
      { instruction: "Enter interface GigabitEthernet 0/0/0 to apply the ACL.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port>." },
      { instruction: "Apply ACL 1 inbound on this interface.", expected: "ip access-group 1 in",
        hint: "Inbound ACLs filter traffic as it arrives on this interface, before routing decisions are made." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify the ACL.", expected: "show access-lists",
        hint: "Shows every configured ACL, its entries in canonical form, and their auto-assigned sequence numbers (10, 20, 30...)." },
      { instruction: "Verify the ACL is applied to the interface.", expected: "show ip interface GigabitEthernet 0/0/0",
        hint: "Look for the \"Inbound  access list is ...\" line — a longer, IP-specific detail report, not \"show ip interface brief\"." }
    ]
  },
  {
    id: "c3_syn_5.4_extended_acls",
    moduleLabel: "Course 3 · SyntxChk · 5.4 — Configure Named Extended ACLs",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Create named extended ACL SURFING.", expected: "ip access-list extended SURFING",
        hint: "Named ACLs are easier to edit and identify than numbered ones — prompt changes to (config-ext-nacl)#." },
      { instruction: "Permit TCP from 192.168.10.0/24 to any destination on port 80 (HTTP).", expected: "permit tcp 192.168.10.0 0.0.0.255 any eq 80",
        hint: "permit tcp <source> <wildcard> <destination> eq <port> — \"any\" matches any destination." },
      { instruction: "Permit TCP from 192.168.10.0/24 to any destination on port 443 (HTTPS).", expected: "permit tcp 192.168.10.0 0.0.0.255 any eq 443",
        hint: "Same shape, different port. All other traffic is implicitly denied at the end of the ACL." },
      { instruction: "Return to global config mode.", expected: "exit",
        hint: "One word takes you up one level from extended ACL config mode." },
      { instruction: "Create named extended ACL BROWSING, for return traffic.", expected: "ip access-list extended BROWSING",
        hint: "A second, separate ACL — one for outbound requests, one for the replies coming back." },
      { instruction: "Permit TCP from any source, with the established flag, to 192.168.10.0/24.", expected: "permit tcp any 192.168.10.0 0.0.0.255 established",
        hint: "The established keyword allows return traffic from sessions initiated inside — without it, replies would be blocked too." },
      { instruction: "Return to global config mode.", expected: "exit",
        hint: "One word takes you up one level from extended ACL config mode." },
      { instruction: "Enter interface GigabitEthernet 0/0/0 (client-facing interface).", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port>." },
      { instruction: "Apply SURFING inbound (traffic from clients heading out).", expected: "ip access-group SURFING in",
        hint: "ip access-group <name> in|out — this one applies to traffic ARRIVING on this interface." },
      { instruction: "Apply BROWSING outbound (return traffic heading back to clients).", expected: "ip access-group BROWSING out",
        hint: "Extended ACLs are typically placed close to the source — here, both directions are filtered on the same client-facing interface." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." }
    ]
  },
  {
    id: "c3_syn_6.4_static_nat",
    moduleLabel: "Course 3 · SyntxChk · 6.4 — Configure Static NAT",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Create a static NAT entry mapping inside 192.168.1.5 to outside 209.165.200.225.", expected: "ip nat inside source static 192.168.1.5 209.165.200.225",
        hint: "This is a permanent, one-to-one mapping — every packet from 192.168.1.5 will appear to come from 209.165.200.225." },
      { instruction: "Enter the inside interface (GigabitEthernet 0/0/0).", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port>." },
      { instruction: "Mark this interface as NAT inside.", expected: "ip nat inside",
        hint: "NAT translates packets leaving this interface outbound." },
      { instruction: "Enter the outside interface (GigabitEthernet 0/0/1).", expected: "interface GigabitEthernet 0/0/1",
        hint: "interface <type> <slot/port>." },
      { instruction: "Mark this interface as NAT outside.", expected: "ip nat outside",
        hint: "NAT translates addresses on packets arriving from the outside." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify NAT translations.", expected: "show ip nat translations",
        hint: "Static entries show up immediately, with no traffic needed — unlike dynamic NAT." }
    ]
  },
  {
    id: "c3_syn_6.5_dynamic_nat",
    moduleLabel: "Course 3 · SyntxChk · 6.5 — Configure Dynamic NAT",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Create NAT pool NAT-POOL1 with addresses 209.165.200.226 to 209.165.200.240 and mask 255.255.255.224.", expected: "ip nat pool NAT-POOL1 209.165.200.226 209.165.200.240 netmask 255.255.255.224",
        hint: "ip nat pool <name> <start> <end> netmask <mask> — this pool has 15 public addresses available." },
      { instruction: "Create ACL 1 to identify which inside addresses are eligible for NAT.", expected: "access-list 1 permit 192.168.0.0 0.0.255.255",
        hint: "Only addresses matching this ACL will be translated — a wildcard of 0.0.255.255 matches the whole 192.168.0.0/16 range." },
      { instruction: "Bind the ACL to the NAT pool.", expected: "ip nat inside source list 1 pool NAT-POOL1",
        hint: "Inside addresses matching ACL 1 will be translated using addresses from NAT-POOL1." },
      { instruction: "Enter inside interface GigabitEthernet 0/0/0.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port>." },
      { instruction: "Mark as NAT inside.", expected: "ip nat inside",
        hint: "Marks this as the private-network-facing interface." },
      { instruction: "Enter outside interface GigabitEthernet 0/0/1.", expected: "interface GigabitEthernet 0/0/1",
        hint: "interface <type> <slot/port>." },
      { instruction: "Mark as NAT outside.", expected: "ip nat outside",
        hint: "Marks this as the public-network-facing interface." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify NAT statistics.", expected: "show ip nat statistics",
        hint: "Shows pool usage and hit/miss counts — total ACTIVE translations stays 0 until real traffic actually flows." }
    ]
  },
  {
    id: "c3_syn_6.6a_pat_address_pool",
    moduleLabel: "Course 3 · SyntxChk · 6.6 — Configure PAT Using an Address Pool",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Create NAT pool NAT-POOL2 from 209.165.200.226 to 209.165.200.228 mask 255.255.255.252.", expected: "ip nat pool NAT-POOL2 209.165.200.226 209.165.200.228 netmask 255.255.255.252",
        hint: "A small pool — PAT will multiplex many inside hosts across just these few addresses using port numbers." },
      { instruction: "Create ACL 1 permitting the 192.168.0.0/16 private range (wildcard 0.0.255.255) to identify inside addresses.", expected: "access-list 1 permit 192.168.0.0 0.0.255.255",
        hint: "access-list <n> permit <network> <wildcard>." },
      { instruction: "Bind ACL 1 to pool NAT-POOL2 with overload (enables PAT).", expected: "ip nat inside source list 1 pool NAT-POOL2 overload",
        hint: "The overload keyword is what actually enables PAT — without it, this would be plain Dynamic NAT (one-to-one, pool exhausts quickly)." },
      { instruction: "Enter interface GigabitEthernet 0/0/0 to mark as NAT inside.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port>." },
      { instruction: "Apply ip nat inside.", expected: "ip nat inside",
        hint: "Marks this as the private-network-facing interface." },
      { instruction: "Enter interface GigabitEthernet 0/0/1 to mark as NAT outside.", expected: "interface GigabitEthernet 0/0/1",
        hint: "interface <type> <slot/port>." },
      { instruction: "Apply ip nat outside.", expected: "ip nat outside",
        hint: "Marks this as the public-network-facing interface." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." }
    ]
  },
  {
    id: "c3_syn_6.6b_pat_single_address",
    moduleLabel: "Course 3 · SyntxChk · 6.6 — Configure PAT Using a Single Interface Address",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Create ACL 1 permitting the 192.168.0.0/16 private range (wildcard 0.0.255.255) to match all inside addresses.", expected: "access-list 1 permit 192.168.0.0 0.0.255.255",
        hint: "access-list <n> permit <network> <wildcard>." },
      { instruction: "Configure PAT using the outside interface's own address — no pool needed.", expected: "ip nat inside source list 1 interface GigabitEthernet 0/0/1 overload",
        hint: "This uses GigabitEthernet 0/0/1's own IP address as the single public address for every translation — the most common setup in small networks." },
      { instruction: "Enter inside interface GigabitEthernet 0/0/0.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port>." },
      { instruction: "Mark as NAT inside.", expected: "ip nat inside",
        hint: "Marks this as the private-network-facing interface." },
      { instruction: "Enter outside interface GigabitEthernet 0/0/1.", expected: "interface GigabitEthernet 0/0/1",
        hint: "interface <type> <slot/port>." },
      { instruction: "Mark as NAT outside.", expected: "ip nat outside",
        hint: "Marks this as the public-network-facing interface." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify NAT translations after traffic flows.", expected: "show ip nat translations",
        hint: "Each entry shows the original inside address mapped to the interface's own IP, differentiated by a unique port number." }
    ]
  },
  {
    id: "c3_syn_10.1_cdp_and_lldp",
    moduleLabel: "Course 3 · SyntxChk · 10.1 — Configure CDP and LLDP",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Enable CDP globally (it's on by default — this confirms/re-enables it).", expected: "cdp run",
        hint: "CDP is enabled globally AND per-interface by default on Cisco devices." },
      { instruction: "Enable LLDP globally — disabled by default, unlike CDP.", expected: "lldp run",
        hint: "LLDP must be explicitly turned on. It's the vendor-neutral equivalent, so it works with non-Cisco equipment too." },
      { instruction: "Enter interface GigabitEthernet 0/0/0.", expected: "interface GigabitEthernet 0/0/0",
        hint: "interface <type> <slot/port>." },
      { instruction: "Enable LLDP transmit on this interface.", expected: "lldp transmit",
        hint: "This interface will now SEND LLDP advertisements to its neighbor." },
      { instruction: "Enable LLDP receive on this interface.", expected: "lldp receive",
        hint: "This interface will now PROCESS LLDP advertisements it receives — both directions are needed for a full LLDP relationship." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify CDP neighbors.", expected: "show cdp neighbors",
        hint: "Shows directly-connected CISCO devices only, with device ID, local interface, and platform." },
      { instruction: "Verify LLDP neighbors.", expected: "show lldp neighbors",
        hint: "LLDP neighbors may include non-Cisco equipment that supports IEEE 802.1AB — CDP can't see those." }
    ]
  },
  {
    id: "c3_syn_10.2_configure_ntp",
    moduleLabel: "Course 3 · SyntxChk · 10.2 — Configure NTP",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode, acting as R1 (the NTP master). If yours isn't, type enable first. This exercise's later steps narrate configuring a second router (R2) as an NTP client — since this tool works with one device at a time, type those steps on the SAME device; think of it as switching your attention to R2's CLI.",
    steps: [
      { instruction: "Enter global configuration mode on R1 (the NTP master).", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Make R1 an NTP master at stratum 1 (the highest accuracy — an atomic/GPS-grade source).", expected: "ntp master 1",
        hint: "ntp master <stratum> — stratum 1 = atomic clock, 2 = synced to a stratum-1 source, and so on." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify NTP status on R1.", expected: "show ntp status",
        hint: "Shows stratum level, reference clock, and synchronization state." },
      { instruction: "Now imagine you're on R2. Enter global configuration mode there.", expected: "configure terminal",
        hint: "Same command, just narratively on a different device now — R2 will be configured as an NTP client of R1." },
      { instruction: "Set R2 to use 10.1.1.1 (R1) as its NTP server.", expected: "ntp server 10.1.1.1",
        hint: "ntp server <ip-address> — R2 will synchronize its clock FROM this address." },
      { instruction: "Return to privileged EXEC mode on R2.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify NTP associations on R2.", expected: "show ntp associations",
        hint: "The * marks the currently-synced server; st = stratum of that peer." }
    ]
  },
  {
    id: "c3_syn_10.3_configure_snmpv2c",
    moduleLabel: "Course 3 · SyntxChk · 10.3 — Configure SNMPv2c",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Set the SNMP read-only community string to cisco.", expected: "snmp-server community cisco ro",
        hint: "ro = read-only. The NMS can query the device, but not change its configuration." },
      { instruction: "Set the SNMP read-write community string to cisco123.", expected: "snmp-server community cisco123 rw",
        hint: "rw = read-write. The NMS can both query AND modify configuration — treat this string more carefully than the read-only one." },
      { instruction: "Set the device location to Cisco NetAcad.", expected: "snmp-server location Cisco NetAcad",
        hint: "Purely informational — appears in the sysLocation MIB object for anyone querying this device." },
      { instruction: "Set the contact information to Admin.", expected: "snmp-server contact Admin",
        hint: "Appears in the sysContact MIB object." },
      { instruction: "Configure SNMP traps to be sent to the NMS at 192.168.1.100 using community cisco.", expected: "snmp-server host 192.168.1.100 version 2c cisco",
        hint: "Traps are unsolicited alerts sent FROM this device TO the NMS, as events happen — not something the NMS has to ask for." },
      { instruction: "Enable all SNMP traps.", expected: "snmp-server enable traps",
        hint: "Without this, trap destinations are configured but nothing actually gets sent." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify the configured community strings.", expected: "show snmp community",
        hint: "Shows each community string and its access level — treat this output as sensitive, since these strings act like passwords." }
    ]
  },
  {
    id: "c3_syn_10.4_configure_syslog",
    moduleLabel: "Course 3 · SyntxChk · 10.4 — Configure Syslog",
    status: "available",
    precondition: "This lab assumes the device is already in privileged EXEC mode. If yours isn't, type enable first.",
    steps: [
      { instruction: "Enter global configuration mode.", expected: "configure terminal",
        hint: "From privileged EXEC mode, this two-word command enters global config mode." },
      { instruction: "Set the syslog server address to 192.168.1.100.", expected: "logging host 192.168.1.100",
        hint: "logging host <ip-address> — this is where log messages get forwarded." },
      { instruction: "Set the logging severity level to informational (level 6).", expected: "logging trap informational",
        hint: "Logs everything at severity 0-6. Level 7 (debug, the least severe/most verbose) is excluded." },
      { instruction: "Set the source interface for log messages to Loopback 0.", expected: "logging source-interface Loopback 0",
        hint: "A loopback interface never physically goes down, so it guarantees a consistent source IP on every log message even if a real interface flaps." },
      { instruction: "Enable millisecond-precision timestamps on log messages.", expected: "service timestamps log datetime msec",
        hint: "Timestamps are essential for correlating events during troubleshooting or a security investigation." },
      { instruction: "Return to privileged EXEC mode.", expected: "end",
        hint: "One word jumps straight back to privileged EXEC mode from any subconfig mode." },
      { instruction: "Verify the logging configuration.", expected: "show logging",
        hint: "Shows logging destinations, severity thresholds, and buffer/console logging status." }
    ]
  }
];

function getExercise(id) {
  return EXERCISES.find(function (ex) { return ex.id === id; }) || null;
}

function createExerciseRun(exerciseId) {
  return { exerciseId: exerciseId, stepIndex: 0, attemptCount: 0, complete: false };
}

function checkExerciseStep(run, rawLine) {
  const exercise = getExercise(run.exerciseId);
  if (!exercise) return { valid: false, error: "Unknown exercise." };
  if (run.complete) return { valid: false, error: "Exercise already complete." };

  const step = exercise.steps[run.stepIndex];
  const trimmed = rawLine.trim().toLowerCase();
  const expected = step.expected.trim().toLowerCase();

  if (trimmed === expected) {
    run.stepIndex += 1;
    run.attemptCount = 0;
    if (run.stepIndex >= exercise.steps.length) {
      run.complete = true;
      return { correct: true, exerciseComplete: true };
    }
    return { correct: true, exerciseComplete: false, nextInstruction: exercise.steps[run.stepIndex].instruction };
  }

  run.attemptCount += 1;
  let feedback;
  // v1.35.0: escalation shortened from 3 bare attempts + hint on 4th
  // to 2 bare attempts + hint on the 3rd, per direction — the person
  // found the original ladder too slow during real practice sessions.
  if (run.attemptCount === 1) {
    feedback = { level: "bare", message: "Not quite — try again." };
  } else if (run.attemptCount === 2) {
    feedback = { level: "hint", message: "Hint: " + step.hint };
  } else {
    feedback = { level: "answer", message: "The expected command is: " + step.expected + "  (type it in to continue)" };
  }
  return { correct: false, feedback: feedback };
}


/* ---------------------------------------------------------
   EXPORTS
   --------------------------------------------------------- */

if (typeof window !== "undefined") {
  window.IOSEngine = {
    version: IOS_ENGINE_VERSION,
    createDevice, getPrompt, executeLine, getCompletions, resolveAbbreviations,
    normalizeInterfaceName, isValidIPv6Address, DEVICE_MODELS, COMMANDS, RESERVED_WORDS, EXERCISES,
    getExercise, createExerciseRun, checkExerciseStep
  };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    IOS_ENGINE_VERSION,
    createDevice, getPrompt, executeLine, getCompletions, resolveAbbreviations,
    normalizeInterfaceName, isValidIPv6Address, DEVICE_MODELS, COMMANDS, RESERVED_WORDS, EXERCISES,
    getExercise, createExerciseRun, checkExerciseStep
  };
}
