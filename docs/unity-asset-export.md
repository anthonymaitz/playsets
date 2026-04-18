# Exporting Sprites from Unity

1. Open the Unity project in Unity Editor
2. In the Project window, select all sprite assets you want to export
3. For each sprite: right-click → Show in Explorer/Finder, then copy the PNG from the texture folder
   - Alternatively: install "Unity Package Exporter" or write a simple Editor script (see below)
4. Organize PNGs into folders: tokens/, props/, terrain/, effects/
5. Copy all folders into: apps/client/public/assets/sprites/
6. Run: `pnpm generate-manifest`

## Batch Export Editor Script (Assets/Editor/SpriteExporter.cs)
Create this file in your Unity project to batch-export:

```csharp
using UnityEditor;
using UnityEngine;
using System.IO;

public class SpriteExporter
{
    [MenuItem("Tools/Export All Sprites")]
    static void ExportAll()
    {
        var sprites = AssetDatabase.FindAssets("t:Sprite");
        foreach (var guid in sprites)
        {
            var path = AssetDatabase.GUIDToAssetPath(guid);
            var tex = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            if (tex == null) continue;
            var bytes = tex.EncodeToPNG();
            var outPath = "ExportedSprites/" + Path.GetFileNameWithoutExtension(path) + ".png";
            Directory.CreateDirectory(Path.GetDirectoryName(outPath));
            File.WriteAllBytes(outPath, bytes);
        }
        Debug.Log("Export complete: ExportedSprites/");
    }
}
```
