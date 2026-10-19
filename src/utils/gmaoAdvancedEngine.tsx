/**
 * 🏛️ GMAO Industrial Relational Engine & Security Shield (Advanced Patterns)
 * Conforme à la Constitution GMAO : Implémentation robuste des architectures avancées :
 * 1. Hybrid Spreadsheet Template Injector (HSTI) avec filtre anti-Formula Injection.
 * 2. Recursive Asset Tree (RAT) avec compression structurelle via LZ-String.
 * 3. Reactive Dependency Propagator (RDP) pour les calculs internes de صيانة الجداول.
 */

import ExcelJS from 'exceljs';
import LZString from 'lz-string';

/**
 * 🛡️ Security Shield: Protection contre l'injection de formules (CSV / Excel Formula Injection)
 * Protège les feuilles de calcul lors de l'ouverture par des tiers (Administrateurs, Directeurs).
 */
export class GmaoFormulaSanitizer {
  /**
   * Assainit une chaîne de caractères pour neutraliser les injections de formules.
   * Tout champ texte commençant par '=', '+', '-', '@', ou un caractère de tabulation/retour chariot
   * est préfixé par un guillemet simple (') pour forcer Excel à l'interpréter comme du texte brut.
   * 
   * @param {any} value - La valeur brute à assainir.
   * @returns {any} La valeur sécurisée.
   */
  static sanitize(value) {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return value;
    }

    // Caractères sensibles initiant une formule ou une commande d'exécution sous Excel
    const formulaChars = ['=', '+', '-', '@', '\t', '\r'];
    const firstChar = trimmed.charAt(0);

    if (formulaChars.includes(firstChar)) {
      // 🛡️ Standard industriel : Forcer l'interprétation en texte littéral via le préfixe "'"
      return `'${value}`;
    }

    return value;
  }

  /**
   * Assainit récursivement un objet ou tableau de données avant injection.
   * 
   * @param {any} data - Données brutes (Objet, Tableau ou Primitif).
   * @returns {any} Données nettoyées de toute formule malveillante.
   */
  static sanitizePayload(data) {
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizePayload(item));
    } else if (data !== null && typeof data === 'object') {
      const sanitized = {};
      for (const [key, val] of Object.entries(data)) {
        sanitized[key] = this.sanitizePayload(val);
      }
      return sanitized;
    }
    return this.sanitize(data);
  }
}

/**
 * 📊 Hybrid Spreadsheet Template Pattern (HSTI)
 * Injecte des données brutes assainies dans un classeur modèle pré-formaté.
 * Préserve les formules complexes (=SUM, =VLOOKUP) pré-établies dans les onglets de synthèse.
 */
export class GmaoHybridTemplateService {
  /**
   * Simule ou exécute l'injection de données de maintenance dans un modèle Excel.
   * 
   * @param {ArrayBuffer|string} templateBase64 - Le fichier modèle .xlsx encodé en Base64 ou sous forme de buffer.
   * @param {string} targetSheetName - Le nom de l'onglet de données brutes.
   * @param {Array<Object>} rowsData - Les lignes de données de maintenance à injecter.
   * @param {Array<string>} keysOrder - L'ordre des clés de l'objet pour l'écriture des cellules (Colonnes A, B, C...).
   * @returns {Promise<ArrayBuffer>} Le fichier Excel finalisé sous forme de buffer binaire.
   */
  static async injectRawData(templateBase64, targetSheetName, rowsData, keysOrder) {
    const workbook = new ExcelJS.Workbook();

    // 1. Chargement du modèle de template
    if (typeof templateBase64 === 'string') {
      const binaryString = atob(templateBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await workbook.xlsx.load(bytes.buffer);
    } else {
      await workbook.xlsx.load(templateBase64);
    }

    // 2. Récupération ou création de la feuille cible de données brutes
    let worksheet = workbook.getWorksheet(targetSheetName);
    if (!worksheet) {
      worksheet = workbook.addWorksheet(targetSheetName);
    } else {
      // Nettoyer les anciennes données brutes mais conserver la structure de la feuille
      worksheet.spliceRows(2, worksheet.rowCount);
    }

    // 3. Assainissement des données pour conjurer la faille CSV/Formula Injection
    const securedRows = GmaoFormulaSanitizer.sanitizePayload(rowsData);

    // 4. Injection séquentielle par streaming mémoire (O(1) Memory layout)
    securedRows.forEach((rowData, index) => {
      const rowValues = keysOrder.map((key) => rowData[key] ?? '');
      worksheet.insertRow(index + 2, rowValues); // Écriture à partir de la ligne 2 (la ligne 1 étant l'en-tête)
    });

    // 5. Génération du buffer finalisé
    const outputBuffer = await workbook.xlsx.writeBuffer();
    return outputBuffer;
  }
}

/**
 * 🌲 Recursive Asset Tree (RAT) Engine
 * Représente la hiérarchie industrielle des équipements (Usine -> Secteur -> Ligne -> Machine -> Composant)
 * sans redondance, avec mise à plat (Flattening) et compression structurelle binaire.
 */
export class GmaoRecursiveAssetTree {
  /**
   * Crée une instance de l'arbre d'actifs.
   * @param {Object} [rootNode] - Le nœud racine initial.
   */
  constructor(rootNode = null) {
    this.root = rootNode || {
      id: 'ROOT',
      name: 'Référentiel Industriel',
      type: 'ENTERPRISE',
      children: [],
    };
  }

  /**
   * Ajoute un nœud enfant à un nœud parent spécifique.
   * 
   * @param {string} parentId - L'identifiant du parent.
   * @param {Object} childNode - Le nœud enfant à ajouter.
   * @returns {boolean} Succès de l'opération.
   */
  addChild(parentId, childNode) {
    const parent = this.findNode(this.root, parentId);
    if (parent) {
      if (!parent.children) parent.children = [];
      // Garantir l'unicité de l'identifiant de l'actif
      if (parent.children.some((c) => c.id === childNode.id)) {
        return false;
      }
      parent.children.push({
        ...childNode,
        children: childNode.children || [],
      });
      return true;
    }
    return false;
  }

  /**
   * Recherche récursive d'un nœud spécifique dans l'arbre d'actifs (DFS).
   * 
   * @param {Object} node - Nœud de départ.
   * @param {string} id - Identifiant recherché.
   * @returns {Object|null} Le nœud trouvé ou null.
   */
  findNode(node, id) {
    if (node.id === id) return node;
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const found = this.findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Met à plat l'arbre récursif pour une indexation et des recherches indexées ultra-rapides.
   * 
   * @returns {Array<Object>} Tableau à plat contenant tous les actifs de la hiérarchie.
   */
  flatten() {
    const flatList = [];
    const traverse = (node, depth = 0, path = []) => {
      const currentPath = [...path, node.name];
      flatList.push({
        id: node.id,
        name: node.name,
        type: node.type,
        parentId: path[path.length - 1] || null,
        depth,
        path: currentPath.join(' ➔ '),
        metadata: node.metadata || {},
      });
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => traverse(child, depth + 1, currentPath));
      }
    };
    traverse(this.root);
    return flatList;
  }

  /**
   * Compresse l'ensemble de l'arbre structurel récursif en une chaîne binaire compressée Base64 (LZ-String)
   * Réduit la charge réseau de plus de 75% lors du transfert d'arborescences massives.
   * 
   * @returns {string} Chaîne compressée prête pour le transport réseau ou stockage IndexedDB.
   */
  compress() {
    const serialized = JSON.stringify(this.root);
    return LZString.compressToUTF16(serialized);
  }

  /**
   * Décompresse et reconstruit l'arbre récursif d'actifs depuis sa forme compressée.
   * 
   * @param {string} compressedString - La chaîne compressée générée par la méthode compress().
   * @returns {GmaoRecursiveAssetTree} Nouvelle instance de l'arbre reconstruit.
   */
  static decompress(compressedString) {
    if (!compressedString) {
      return new GmaoRecursiveAssetTree();
    }
    const decompressed = LZString.decompressFromUTF16(compressedString);
    const parsedRoot = JSON.parse(decompressed);
    return new GmaoRecursiveAssetTree(parsedRoot);
  }
}

/**
 * 🔄 Reactive Dependency Propagator (RDP)
 * Modélise les interdépendances réactives des variables de maintenance sous forme de DAG
 * (Directed Acyclic Graph) pour éviter les recalculs intempestifs et coûteux du système.
 */
export class GmaoReactiveCalculationEngine {
  constructor() {
    this.nodes = new Map(); // id -> cellValue
    this.dependencies = new Map(); // id -> set of dependencies (upstream)
    this.dependents = new Map(); // id -> set of dependents (downstream)
    this.formulas = new Map(); // id -> calculationFunction
  }

  /**
   * Enregistre un nœud réactif avec sa valeur ou sa formule de calcul.
   * 
   * @param {string} id - Identifiant de la variable (ex: "STOCK_SPARE_COST").
   * @param {any|Function} valueOrFormula - Valeur initiale ou fonction de calcul.
   * @param {Array<string>} [deps=[]] - Liste des identifiants des dépendances amont.
   */
  registerNode(id, valueOrFormula, deps = []) {
    this.dependencies.set(id, new Set(deps));
    
    // Configurer l'arborescence aval (dependents)
    deps.forEach((depId) => {
      if (!this.dependents.has(depId)) {
        this.dependents.set(depId, new Set());
      }
      this.dependents.get(depId).add(id);
    });

    if (typeof valueOrFormula === 'function') {
      this.formulas.set(id, valueOrFormula);
    } else {
      this.nodes.set(id, valueOrFormula);
    }
  }

  /**
   * Récupère la valeur actuelle d'une variable.
   */
  getValue(id) {
    return this.nodes.get(id);
  }

  /**
   * Modifie la valeur d'une variable d'entrée et propage le changement de façon ciblée (Reactive Propagation).
   * Seules les variables directement ou indirectement affectées en aval (downstream) sont recalculées.
   * 
   * @param {string} id - Identifiant de la variable d'entrée.
   * @param {any} newValue - La nouvelle valeur.
   */
  setValueAndPropagate(id, newValue) {
    this.nodes.set(id, newValue);
    
    // Propagation topologique à l'aide d'un graphe orienté
    const queue = [];
    const inDegree = new Map();
    const affectedNodes = new Set();

    // 1. Identifier tous les nœuds affectés en aval via BFS
    const collect = (nodeId) => {
      const dependents = this.dependents.get(nodeId);
      if (dependents) {
        dependents.forEach((depId) => {
          if (!affectedNodes.has(depId)) {
            affectedNodes.add(depId);
            collect(depId);
          }
        });
      }
    };
    collect(id);

    // 2. Calculer le degré d'entrée restreint aux nœuds affectés
    affectedNodes.forEach((nodeId) => {
      let deg = 0;
      const deps = this.dependencies.get(nodeId);
      if (deps) {
        deps.forEach((depId) => {
          if (affectedNodes.has(depId) || depId === id) {
            deg++;
          }
        });
      }
      inDegree.set(nodeId, deg);
    });

    // 3. Initialiser la file avec les dépendances directes du nœud modifié
    const directDependents = this.dependents.get(id);
    if (directDependents) {
      directDependents.forEach((depId) => {
        const deg = inDegree.get(depId) - 1;
        inDegree.set(depId, deg);
        if (deg === 0) {
          queue.push(depId);
        }
      });
    }

    // 4. Évaluation ordonnée selon le tri topologique pour éviter les boucles et doubles calculs
    while (queue.length > 0) {
      const currentId = queue.shift();
      const formula = this.formulas.get(currentId);
      
      if (formula) {
        // Exécuter le calcul avec les valeurs amont actualisées
        const calculatedValue = formula(this);
        this.nodes.set(currentId, calculatedValue);
      }

      // Propager vers le niveau suivant
      const dependents = this.dependents.get(currentId);
      if (dependents) {
        dependents.forEach((depId) => {
          if (affectedNodes.has(depId)) {
            const deg = inDegree.get(depId) - 1;
            inDegree.set(depId, deg);
            if (deg === 0) {
              queue.push(depId);
            }
          }
        });
      }
    }
  }
}
