import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { fabric } from 'fabric';
import { Tool } from '@/types/whiteboard';
import socket from "@/lib/socket";

interface CanvasProps {
  roomId?: string;
  activeTool: Tool;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  opacity: number;
  onHistoryChange: (canvasState: string) => void;
  onUndo: string | null;
  onRedo: string | null;
  onClear: boolean;
  onExport: boolean;
  resetClear: () => void;
  resetExport: () => void;
  initialCanvasData?: any;
  onCanvasStateChange?: (canvasData: any) => void;
  userPermission?: 'edit' | 'view';
}

export interface CanvasRef {
  toJSON: () => any;
  loadFromJSON: (data: any) => void;
}

export const Canvas = forwardRef<CanvasRef, CanvasProps>(({
  roomId,
  activeTool,
  strokeColor,
  strokeWidth,
  fillColor,
  opacity,
  onHistoryChange,
  onUndo,
  onRedo,
  onClear,
  onExport,
  resetClear,
  resetExport,
  initialCanvasData,
  onCanvasStateChange,
  userPermission = 'edit',
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentObject, setCurrentObject] = useState<fabric.Object | null>(null);
  const [isReceivingUpdate, setIsReceivingUpdate] = useState(false);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: window.innerWidth - 32,
      height: window.innerHeight - 120,
      backgroundColor: '#ffffff',
      selection: false,
    });

    fabricCanvasRef.current = canvas;

    // Handle window resize
    const handleResize = () => {
      canvas.setDimensions({
        width: window.innerWidth - 32,
        height: window.innerHeight - 120,
      });
      canvas.renderAll();
    };

    window.addEventListener('resize', handleResize);

    // Save initial state
    setTimeout(() => {
      const canvasState = JSON.stringify(canvas.toJSON());
      onHistoryChange(canvasState);
    }, 100);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []);

  // Load initial canvas data
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !initialCanvasData) return;

    try {
      setIsReceivingUpdate(true); // Prevent socket updates during initial load
      canvas.loadFromJSON(initialCanvasData, () => {
        canvas.renderAll();
        console.log('✅ Initial canvas data loaded successfully');
        // Save the loaded state to history
        setTimeout(() => {
          const canvasState = JSON.stringify(canvas.toJSON());
          onHistoryChange(canvasState);
          setIsReceivingUpdate(false); // Re-enable socket updates
        }, 100);
      });
    } catch (error) {
      console.error('Failed to load initial canvas data:', error);
      setIsReceivingUpdate(false);
    }
  }, [initialCanvasData]);

  // Socket.IO real-time collaboration
  useEffect(() => {
    if (!roomId) return;

    // Delay socket connection to avoid interference with initial data loading
    const socketTimeout = setTimeout(() => {
      // Listen for canvas updates from other users
      const handleReceiveUpdate = (canvasData: any) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas || isReceivingUpdate) return; // Don't update during initial load

        try {
          setIsReceivingUpdate(true);
          console.log('📨 Receiving canvas update from another user');
          // Load the received canvas data without triggering local events
          canvas.loadFromJSON(canvasData, () => {
            canvas.renderAll();
            setIsReceivingUpdate(false);
          });
        } catch (error) {
          console.error('Error applying remote canvas update:', error);
          setIsReceivingUpdate(false);
        }
      };

      socket.on('receive-update', handleReceiveUpdate);
      console.log('🔌 Socket listener attached for room:', roomId);

      // Cleanup function
      return () => {
        socket.off('receive-update', handleReceiveUpdate);
        console.log('🔌 Socket listener removed for room:', roomId);
      };
    }, 1000); // 1 second delay to allow initial canvas loading

    // Cleanup
    return () => {
      clearTimeout(socketTimeout);
      socket.off('receive-update');
    };
  }, [roomId, initialCanvasData]); // Add initialCanvasData as dependency

  // Emit canvas updates to other users
  const emitCanvasUpdate = (canvasData: any) => {
    if (roomId && canvasData) {
      socket.emit('canvas-update', { roomId, data: canvasData });
    }
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    toJSON: () => {
      const canvas = fabricCanvasRef.current;
      return canvas ? canvas.toJSON() : null;
    },
    loadFromJSON: (data: any) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !data) return;
      
      try {
        canvas.loadFromJSON(data, () => {
          canvas.renderAll();
        });
      } catch (error) {
        console.error('Failed to load canvas data:', error);
      }
    }
  }));

  // Handle tool changes and canvas configuration
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Reset canvas interaction mode
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.forEachObject((obj) => {
      obj.selectable = false;
      obj.evented = false;
    });

    // Only allow editing if user has edit permission
    if (userPermission === 'view') {
      // For view-only users, disable all editing capabilities
      canvas.selection = false;
      canvas.isDrawingMode = false;
      canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
      return;
    }

    // Configure canvas based on active tool (only for users with edit permission)
    switch (activeTool) {
      case 'select':
        canvas.selection = true;
        canvas.forEachObject((obj) => {
          obj.selectable = true;
          obj.evented = true;
        });
        break;
      
      case 'pen':
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush.width = strokeWidth;
        canvas.freeDrawingBrush.color = strokeColor;
        break;
      
      case 'eraser':
        canvas.isDrawingMode = true;
        // Simulate eraser by drawing with white color
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.width = strokeWidth * 2;
        canvas.freeDrawingBrush.color = '#ffffff';
        break;
    }

    canvas.renderAll();
  }, [activeTool, strokeColor, strokeWidth, userPermission]);

  // Handle shape drawing (rectangle, circle, text)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (options: fabric.IEvent) => {
      // Check if user has edit permission
      if (userPermission === 'view') {
        return; // Block editing for view-only users
      }
      
      if (!['rectangle', 'circle', 'text'].includes(activeTool)) return;

      const pointer = canvas.getPointer(options.e);
      setStartPoint({ x: pointer.x, y: pointer.y });
      setIsDrawing(true);

      // Handle text tool
      if (activeTool === 'text') {
        const text = new fabric.IText('Click to edit', {
          left: pointer.x,
          top: pointer.y,
          fontFamily: 'Arial',
          fontSize: 20,
          fill: strokeColor,
          opacity: opacity,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        saveCanvasState();
        return;
      }

      // Create shape objects
      let object: fabric.Object | null = null;

      if (activeTool === 'rectangle') {
        object = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: fillColor === 'transparent' ? 'transparent' : fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          opacity: opacity,
        });
      } else if (activeTool === 'circle') {
        object = new fabric.Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 0,
          fill: fillColor === 'transparent' ? 'transparent' : fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          opacity: opacity,
        });
      }

      if (object) {
        canvas.add(object);
        setCurrentObject(object);
      }
    };

    const handleMouseMove = (options: fabric.IEvent) => {
      // Check if user has edit permission
      if (userPermission === 'view') {
        return;
      }
      
      if (!isDrawing || !startPoint || !currentObject) return;

      const pointer = canvas.getPointer(options.e);
      
      if (activeTool === 'rectangle') {
        const rect = currentObject as fabric.Rect;
        rect.set({
          width: Math.abs(pointer.x - startPoint.x),
          height: Math.abs(pointer.y - startPoint.y),
        });
        
        if (pointer.x < startPoint.x) {
          rect.set({ left: pointer.x });
        }
        if (pointer.y < startPoint.y) {
          rect.set({ top: pointer.y });
        }
      } else if (activeTool === 'circle') {
        const circle = currentObject as fabric.Circle;
        const radius = Math.sqrt(
          Math.pow(pointer.x - startPoint.x, 2) + Math.pow(pointer.y - startPoint.y, 2)
        ) / 2;
        circle.set({ radius: radius });
      }

      canvas.renderAll();
    };

    const handleMouseUp = () => {
      // Check if user has edit permission
      if (userPermission === 'view') {
        return;
      }
      
      if (isDrawing && currentObject) {
        saveCanvasState();
      }
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentObject(null);
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [activeTool, strokeColor, strokeWidth, fillColor, opacity, isDrawing, startPoint, currentObject]);

  // Handle path created (for pen and eraser)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handlePathCreated = () => {
      saveCanvasState();
    };

    const handleObjectModified = () => {
      // Check if user has edit permission
      if (userPermission === 'view') {
        return;
      }
      
      saveCanvasState();
    };

    canvas.on('path:created', handlePathCreated);
    canvas.on('object:modified', handleObjectModified);

    return () => {
      canvas.off('path:created', handlePathCreated);
      canvas.off('object:modified', handleObjectModified);
    };
  }, []);

  // Save canvas state for history
  const saveCanvasState = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || isReceivingUpdate) return; // Don't emit during remote updates
    
    setTimeout(() => {
      const canvasState = JSON.stringify(canvas.toJSON());
      const canvasData = canvas.toJSON();
      
      onHistoryChange(canvasState);
      
      // Emit real-time update to other users
      emitCanvasUpdate(canvasData);
      
      // Also trigger canvas state change callback for persistence
      if (onCanvasStateChange) {
        onCanvasStateChange(canvasData);
      }
    }, 100);
  };

  // Handle undo
  useEffect(() => {
    if (!onUndo) return;
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      canvas.loadFromJSON(onUndo, () => {
        canvas.renderAll();
      });
    } catch (error) {
      console.error('Failed to undo:', error);
    }
  }, [onUndo]);

  // Handle redo
  useEffect(() => {
    if (!onRedo) return;
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      canvas.loadFromJSON(onRedo, () => {
        canvas.renderAll();
      });
    } catch (error) {
      console.error('Failed to redo:', error);
    }
  }, [onRedo]);

  // Handle clear canvas
  useEffect(() => {
    if (!onClear) return;
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.clear();
    canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
    saveCanvasState();
    resetClear();
  }, [onClear, resetClear]);

  // Handle export
  useEffect(() => {
    if (!onExport) return;
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });

    const link = document.createElement('a');
    link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataURL;
    link.click();
    
    resetExport();
  }, [onExport, resetExport]);

  
  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 p-4 overflow-hidden">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden h-full border border-slate-200">
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
});

Canvas.displayName = 'Canvas';