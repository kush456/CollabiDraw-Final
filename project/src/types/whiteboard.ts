export type Tool = 'select' | 'pen' | 'rectangle' | 'circle' | 'text' | 'eraser';

export interface WhiteboardState {
  activeTool: Tool;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  opacity: number;
}

export interface CanvasHistory {
  undo: string[];
  redo: string[];
}