import { useState, useCallback } from 'react';
import { Tool, WhiteboardState, CanvasHistory } from '@/types/whiteboard';

export const useWhiteboard = () => {
  const [state, setState] = useState<WhiteboardState>({
    activeTool: 'select',
    strokeColor: '#000000',
    strokeWidth: 2,
    fillColor: 'transparent',
    opacity: 1,
  });

  const [history, setHistory] = useState<CanvasHistory>({
    undo: [],
    redo: [],
  });

  const setActiveTool = useCallback((tool: Tool) => {
    setState(prev => ({ ...prev, activeTool: tool }));
  }, []);

  const setStrokeColor = useCallback((color: string) => {
    setState(prev => ({ ...prev, strokeColor: color }));
  }, []);

  const setStrokeWidth = useCallback((width: number) => {
    setState(prev => ({ ...prev, strokeWidth: width }));
  }, []);

  const setFillColor = useCallback((color: string) => {
    setState(prev => ({ ...prev, fillColor: color }));
  }, []);

  const setOpacity = useCallback((opacity: number) => {
    setState(prev => ({ ...prev, opacity }));
  }, []);

  const addToHistory = useCallback((canvasState: string) => {
    setHistory(prev => ({
      undo: [...prev.undo, canvasState].slice(-50), // Keep last 50 states
      redo: [],
    }));
  }, []);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.undo.length === 0) return prev;
      const lastState = prev.undo[prev.undo.length - 1];
      return {
        undo: prev.undo.slice(0, -1),
        redo: [lastState, ...prev.redo].slice(0, 50),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.redo.length === 0) return prev;
      const nextState = prev.redo[0];
      return {
        undo: [...prev.undo, nextState].slice(-50),
        redo: prev.redo.slice(1),
      };
    });
  }, []);

  const canUndo = history.undo.length > 0;
  const canRedo = history.redo.length > 0;

  return {
    state,
    history,
    setActiveTool,
    setStrokeColor,
    setStrokeWidth,
    setFillColor,
    setOpacity,
    addToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};