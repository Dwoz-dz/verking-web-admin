import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import {
    Box,
    Eye,
    EyeOff,
    Navigation,
    Palette,
    Plus,
    RotateCcw,
    Save,
    Trash2,
    Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
    use3DConfig,
    type Config3D,
    type Waypoint,
} from "../../pages/experience/use3DConfig";

export function Admin3DParams() {
  const { config, setConfig, resetConfig } = use3DConfig();
  const [previewMode, setPreviewMode] = useState(false);

  const handleSave = () => {
    toast.success("Configuration sauvegardée", {
      description: "Les paramètres 3D ont été mis à jour avec succès.",
    });
  };

  const handleReset = () => {
    if (
      confirm("Êtes-vous sûr de vouloir réinitialiser tous les paramètres ?")
    ) {
      resetConfig();
      toast.success("Réinitialisé", {
        description: "Les paramètres par défaut ont été restaurés.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                Paramètres 3D
              </h1>
              <p className="text-gray-600 mt-1">
                Contrôlez entièrement l'expérience du showroom virtuel
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: previewMode ? "#1f6feb" : "#e5e7eb",
                  color: previewMode ? "#fff" : "#111",
                }}
              >
                {previewMode ? <Eye size={16} /> : <EyeOff size={16} />}
                {previewMode ? "Mode aperçu" : "Mode édition"}
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-amber-100 text-amber-900 hover:bg-amber-200 transition-all"
              >
                <RotateCcw size={16} />
                Réinitialiser
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #E5252A, #c41e23)",
                }}
              >
                <Save size={16} />
                Enregistrer
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="branding" className="w-full">
          <TabsList className="flex gap-2 mb-6 bg-white rounded-xl p-1.5 shadow-sm border border-gray-200">
            <TabsTrigger
              value="branding"
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all data-[state=active]:bg-gray-100"
            >
              <Palette size={16} />
              Marque & Couleurs
            </TabsTrigger>
            <TabsTrigger
              value="scene"
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all data-[state=active]:bg-gray-100"
            >
              <Box size={16} />
              Scène
            </TabsTrigger>
            <TabsTrigger
              value="navigation"
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all data-[state=active]:bg-gray-100"
            >
              <Navigation size={16} />
              Navigation
            </TabsTrigger>
            <TabsTrigger
              value="advanced"
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all data-[state=active]:bg-gray-100"
            >
              <Zap size={16} />
              Avancé
            </TabsTrigger>
          </TabsList>

          {/* ── Branding Tab ── */}
          <TabsContent value="branding" className="space-y-6">
            <BrandingPanel config={config} setConfig={setConfig} />
          </TabsContent>

          {/* ── Scene Tab ── */}
          <TabsContent value="scene" className="space-y-6">
            <ScenePanel config={config} setConfig={setConfig} />
          </TabsContent>

          {/* ── Navigation Tab ── */}
          <TabsContent value="navigation" className="space-y-6">
            <NavigationPanel config={config} setConfig={setConfig} />
          </TabsContent>

          {/* ── Advanced Tab ── */}
          <TabsContent value="advanced" className="space-y-6">
            <AdvancedPanel config={config} setConfig={setConfig} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Branding Panel ───────────────────────────────────────────────────────────
function BrandingPanel({
  config,
  setConfig,
}: {
  config: Config3D;
  setConfig: any;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Text inputs */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-5">
        <h3 className="font-black text-lg text-gray-900">Textes</h3>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Titre principal
          </label>
          <input
            type="text"
            value={config.brand_title}
            onChange={(e) => setConfig({ brand_title: e.target.value })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold"
            placeholder="VERKING"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Sous-titre
          </label>
          <input
            type="text"
            value={config.brand_subtitle}
            onChange={(e) => setConfig({ brand_subtitle: e.target.value })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold"
            placeholder="S.T.P Stationery"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Label Cartables (FR)
          </label>
          <input
            type="text"
            value={config.section_label_cartables_fr}
            onChange={(e) =>
              setConfig({ section_label_cartables_fr: e.target.value })
            }
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Label Cartables (AR)
          </label>
          <input
            type="text"
            value={config.section_label_cartables_ar}
            onChange={(e) =>
              setConfig({ section_label_cartables_ar: e.target.value })
            }
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
            dir="rtl"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Label Trousses (FR)
          </label>
          <input
            type="text"
            value={config.section_label_trousses_fr}
            onChange={(e) =>
              setConfig({ section_label_trousses_fr: e.target.value })
            }
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Label Trousses (AR)
          </label>
          <input
            type="text"
            value={config.section_label_trousses_ar}
            onChange={(e) =>
              setConfig({ section_label_trousses_ar: e.target.value })
            }
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
            dir="rtl"
          />
        </div>
      </div>

      {/* Right: Colors */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-5">
        <h3 className="font-black text-lg text-gray-900">Couleurs</h3>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Couleur primaire
          </label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={config.primary_color}
              onChange={(e) => setConfig({ primary_color: e.target.value })}
              className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
            />
            <input
              type="text"
              value={config.primary_color}
              onChange={(e) => setConfig({ primary_color: e.target.value })}
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Couleur secondaire
          </label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={config.secondary_color}
              onChange={(e) => setConfig({ secondary_color: e.target.value })}
              className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
            />
            <input
              type="text"
              value={config.secondary_color}
              onChange={(e) => setConfig({ secondary_color: e.target.value })}
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Couleur accent
          </label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={config.accent_color}
              onChange={(e) => setConfig({ accent_color: e.target.value })}
              className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
            />
            <input
              type="text"
              value={config.accent_color}
              onChange={(e) => setConfig({ accent_color: e.target.value })}
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Couleur du sol
          </label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={config.floor_color}
              onChange={(e) => setConfig({ floor_color: e.target.value })}
              className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
            />
            <input
              type="text"
              value={config.floor_color}
              onChange={(e) => setConfig({ floor_color: e.target.value })}
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Couleur des murs
          </label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={config.wall_color}
              onChange={(e) => setConfig({ wall_color: e.target.value })}
              className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
            />
            <input
              type="text"
              value={config.wall_color}
              onChange={(e) => setConfig({ wall_color: e.target.value })}
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Scene Panel ──────────────────────────────────────────────────────────────
function ScenePanel({
  config,
  setConfig,
}: {
  config: Config3D;
  setConfig: any;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-6">
      <h3 className="font-black text-lg text-gray-900">Paramètres de scène</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Couleur du brouillard
          </label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={config.fog_color}
              onChange={(e) => setConfig({ fog_color: e.target.value })}
              className="w-12 h-10 rounded-lg cursor-pointer border-2 border-gray-200"
            />
            <input
              type="text"
              value={config.fog_color}
              onChange={(e) => setConfig({ fog_color: e.target.value })}
              className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Brouillard proche
          </label>
          <input
            type="number"
            value={config.fog_near}
            onChange={(e) =>
              setConfig({ fog_near: parseFloat(e.target.value) })
            }
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="1"
            min="0"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Brouillard loin
          </label>
          <input
            type="number"
            value={config.fog_far}
            onChange={(e) => setConfig({ fog_far: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
            step="1"
            min="0"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Intensité lumière ambiante
          </label>
          <input
            type="range"
            value={config.ambient_intensity}
            onChange={(e) =>
              setConfig({ ambient_intensity: parseFloat(e.target.value) })
            }
            min="0"
            max="1"
            step="0.05"
            className="w-full"
          />
          <div className="text-xs text-gray-600 mt-1">
            {(config.ambient_intensity * 100).toFixed(0)}%
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.show_particles}
              onChange={(e) => setConfig({ show_particles: e.target.checked })}
              className="w-5 h-5 rounded border-2 border-gray-300 accent-blue-600"
            />
            <span className="text-sm font-semibold text-gray-700">
              Afficher les particules
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Navigation Panel ─────────────────────────────────────────────────────────
function NavigationPanel({
  config,
  setConfig,
}: {
  config: Config3D;
  setConfig: any;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleUpdateWaypoint = (id: string, field: string, value: any) => {
    const updated = config.waypoints.map((wp) =>
      wp.id === id ? { ...wp, [field]: value } : wp,
    );
    setConfig({ waypoints: updated });
  };

  const handleDeleteWaypoint = (id: string) => {
    const updated = config.waypoints.filter((wp) => wp.id !== id);
    setConfig({ waypoints: updated });
  };

  const handleAddWaypoint = () => {
    const newWp: Waypoint = {
      id: `waypoint-${Date.now()}`,
      label_fr: "Nouveau point",
      label_ar: "نقطة جديدة",
      position: [0, 1.7, 0],
      lookAt: [0, 1.5, -5],
    };
    setConfig({ waypoints: [...config.waypoints, newWp] });
  };

  return (
    <div className="space-y-4">
      {config.waypoints.map((wp) => (
        <div
          key={wp.id}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-semibold text-gray-900">{wp.label_fr}</p>
              <p className="text-sm text-gray-600">{wp.label_ar}</p>
            </div>
            <button
              onClick={() => handleDeleteWaypoint(wp.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Label FR
              </label>
              <input
                type="text"
                value={wp.label_fr}
                onChange={(e) =>
                  handleUpdateWaypoint(wp.id, "label_fr", e.target.value)
                }
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Label AR
              </label>
              <input
                type="text"
                value={wp.label_ar}
                onChange={(e) =>
                  handleUpdateWaypoint(wp.id, "label_ar", e.target.value)
                }
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                dir="rtl"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Position (X, Y, Z)
              </label>
              <div className="flex gap-2">
                {([0, 1, 2] as const).map((i) => (
                  <input
                    key={i}
                    type="number"
                    value={wp.position[i]}
                    onChange={(e) => {
                      const newPos = [...wp.position] as [
                        number,
                        number,
                        number,
                      ];
                      newPos[i] = parseFloat(e.target.value);
                      handleUpdateWaypoint(wp.id, "position", newPos);
                    }}
                    step="0.5"
                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Regard vers (X, Y, Z)
              </label>
              <div className="flex gap-2">
                {([0, 1, 2] as const).map((i) => (
                  <input
                    key={i}
                    type="number"
                    value={wp.lookAt[i]}
                    onChange={(e) => {
                      const newLook = [...wp.lookAt] as [
                        number,
                        number,
                        number,
                      ];
                      newLook[i] = parseFloat(e.target.value);
                      handleUpdateWaypoint(wp.id, "lookAt", newLook);
                    }}
                    step="0.5"
                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={handleAddWaypoint}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all text-gray-600 hover:text-blue-600"
      >
        <Plus size={16} />
        Ajouter un point de navigation
      </button>
    </div>
  );
}

// ─── Advanced Panel ───────────────────────────────────────────────────────────
function AdvancedPanel({
  config,
  setConfig,
}: {
  config: Config3D;
  setConfig: any;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
      <h3 className="font-black text-lg text-gray-900 mb-6">
        Configuration avancée JSON
      </h3>

      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          ℹ️ Vous pouvez éditer manuellement la configuration JSON complète. Les
          modifications seront sauvegardées dans localStorage.
        </p>
      </div>

      <textarea
        value={JSON.stringify(config, null, 2)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            setConfig(parsed);
          } catch {
            // Invalid JSON, ignore
          }
        }}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg font-mono text-xs focus:outline-none focus:border-blue-500 min-h-96 resize-none"
      />
    </div>
  );
}
