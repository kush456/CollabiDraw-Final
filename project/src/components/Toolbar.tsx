import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { 
  MousePointer2, 
  Pen, 
  Square, 
  Circle, 
  Type, 
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
} from 'lucide-react';
import { Tool } from '@/types/whiteboard';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  activeTool: Tool;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  opacity: number;
  onToolChange: (tool: Tool) => void;
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onFillColorChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const tools = [
  { id: 'select' as Tool, icon: MousePointer2, label: 'Select' },
  { id: 'pen' as Tool, icon: Pen, label: 'Pen' },
  { id: 'rectangle' as Tool, icon: Square, label: 'Rectangle' },
  { id: 'circle' as Tool, icon: Circle, label: 'Circle' },
  { id: 'text' as Tool, icon: Type, label: 'Text' },
  { id: 'eraser' as Tool, icon: Eraser, label: 'Eraser' },
];

const colors = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#ff8000', '#8000ff'
];

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  strokeColor,
  strokeWidth,
  fillColor,
  opacity,
  onToolChange,
  onStrokeColorChange,
  onStrokeWidthChange,
  onFillColorChange,
  onOpacityChange,
  onUndo,
  onRedo,
  onClear,
  onExport,
  canUndo,
  canRedo,
}) => {
  return (
    <div className="bg-slate-800 border-b border-slate-700 p-4">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Tools */}
        <div className="flex items-center gap-2">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant={activeTool === tool.id ? "default" : "ghost"}
              size="sm"
              onClick={() => onToolChange(tool.id)}
              className={cn(
                "h-10 w-10",
                activeTool === tool.id 
                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                  : "text-slate-300 hover:text-white hover:bg-slate-700"
              )}
              title={tool.label}
            >
              <tool.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-8 bg-slate-600" />

        {/* History */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo}
            className="h-10 w-10 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-50"
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRedo}
            disabled={!canRedo}
            className="h-10 w-10 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-50"
            title="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-8 bg-slate-600" />

        {/* Colors */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300 font-medium">Stroke:</span>
            <div className="flex gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => onStrokeColorChange(color)}
                  className={cn(
                    "w-6 h-6 rounded border-2 hover:scale-110 transition-transform",
                    strokeColor === color ? "border-white" : "border-slate-600"
                  )}
                  style={{ backgroundColor: color }}
                  title={`Stroke color: ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300 font-medium">Fill:</span>
            <div className="flex gap-1">
              <button
                onClick={() => onFillColorChange('transparent')}
                className={cn(
                  "w-6 h-6 rounded border-2 bg-white hover:scale-110 transition-transform relative",
                  fillColor === 'transparent' ? "border-white" : "border-slate-600"
                )}
                title="No fill"
              >
                <div className="absolute inset-0 bg-red-500 w-0.5 rotate-45 transform origin-center"></div>
              </button>
              {colors.slice(1).map((color) => (
                <button
                  key={color}
                  onClick={() => onFillColorChange(color)}
                  className={cn(
                    "w-6 h-6 rounded border-2 hover:scale-110 transition-transform",
                    fillColor === color ? "border-white" : "border-slate-600"
                  )}
                  style={{ backgroundColor: color }}
                  title={`Fill color: ${color}`}
                />
              ))}
            </div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-8 bg-slate-600" />

        {/* Controls */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300 font-medium min-w-[60px]">Width:</span>
            <div className="w-24">
              <Slider
                value={[strokeWidth]}
                onValueChange={(value) => onStrokeWidthChange(value[0])}
                max={20}
                min={1}
                step={1}
                className="w-full"
              />
            </div>
            <span className="text-xs text-slate-400 w-6">{strokeWidth}px</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300 font-medium min-w-[60px]">Opacity:</span>
            <div className="w-24">
              <Slider
                value={[opacity * 100]}
                onValueChange={(value) => onOpacityChange(value[0] / 100)}
                max={100}
                min={10}
                step={10}
                className="w-full"
              />
            </div>
            <span className="text-xs text-slate-400 w-8">{Math.round(opacity * 100)}%</span>
          </div>
        </div>

        <Separator orientation="vertical" className="h-8 bg-slate-600" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-10 px-4 text-slate-300 hover:text-white hover:bg-red-600"
            title="Clear Canvas"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            className="h-10 px-4 text-slate-300 hover:text-white hover:bg-green-600"
            title="Export as PNG"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
};