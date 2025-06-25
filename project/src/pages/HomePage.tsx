import React, { useState, useEffect, useRef } from 'react';
import { Canvas, CanvasRef } from '@/components/Canvas';
import { Toolbar } from '@/components/Toolbar';
import { useWhiteboard } from '@/hooks/useWhiteboard';
import { loadRoom, updateRoom, getRoomParticipants, updateParticipantPermission, getUserPermission } from "../api/room";
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft, Copy, Check, Users, Eye, Edit3 } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import socket from '@/lib/socket';
import { useRoomsStore } from '@/stores/useRoomsStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Participant {
  id: string;
  email: string;
  displayName?: string;
  joinedAt: string;
  permission: 'edit' | 'view';
  isOnline: boolean;
}

function HomePage() {
  const {
    state,
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
    history,
  } = useWhiteboard();
  const { user, logout } = useAuthStore();
  const { addRecentRoom, updateRoomAccess } = useRoomsStore();
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [undoState, setUndoState] = useState<string | null>(null);
  const [redoState, setRedoState] = useState<string | null>(null);  const [shouldClear, setShouldClear] = useState(false);  
  const [shouldExport, setShouldExport] = useState(false);  
  const [roomData, setRoomData] = useState<any>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);
  const [initialCanvasData, setInitialCanvasData] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false);
  const [currentUserPermission, setCurrentUserPermission] = useState<'edit' | 'view'>('edit');
  
  const canvasRef = useRef<CanvasRef>(null);

  const handleHistoryChange = (canvasState: string) => {
    addToHistory(canvasState);
  };

  const handleUndo = () => {
    if (history.undo.length > 0) {
      const lastState = history.undo[history.undo.length - 1];
      setUndoState(lastState);
      undo();
    }
  };

  const handleRedo = () => {
    if (history.redo.length > 0) {
      const nextState = history.redo[0];
      setRedoState(nextState);
      redo();
    }
  };

  const handleClear = () => {
    setShouldClear(true);
  };

  const handleExport = () => {
    setShouldExport(true);
  };

  const resetClear = () => {
    setShouldClear(false);
  };

  const resetExport = () => {
    setShouldExport(false);
  };

  React.useEffect(() => {
    if (undoState) {
      const timer = setTimeout(() => setUndoState(null), 100);
      return () => clearTimeout(timer);
    }
  }, [undoState]);
  React.useEffect(() => {
    if (redoState) {
      const timer = setTimeout(() => setRedoState(null), 100);
      return () => clearTimeout(timer);
    }
  }, [redoState]);  // Load room data if roomId is present
  useEffect(() => {    if (roomId) {
      loadRoomData();      // Join the socket room with authentication for real-time collaboration
      const joinRoom = async () => {
        if (user) {
          try {
            const currentUser = auth.currentUser;
            if (currentUser) {
              // Get a fresh token to avoid expired token issues
              const token = await currentUser.getIdToken(true);
              socket.auth = { token };
              socket.connect();
              socket.emit('join-room', roomId);
              console.log(`Joined socket room: ${roomId}`);
            }
          } catch (error) {
            console.error('Error getting auth token for socket:', error);
          }
        }
      };
      joinRoom();
    }

    // Cleanup: leave room when component unmounts or roomId changes
    return () => {
      if (roomId) {
        socket.emit('leave-room', roomId);
        console.log(`Left socket room: ${roomId}`);
      }
    };
  }, [roomId, user]);
  const loadRoomData = async () => {
    if (!roomId) return;
      try {
      setIsLoadingRoom(true);
      const data = await loadRoom(roomId);
      setRoomData(data);
      
      // Add room to recent rooms and update access time
      if (data) {
        const roomForStore = {
          id: data.roomId || roomId,
          roomId: data.roomId || roomId,
          roomName: data.roomName || 'Unnamed Room',
          isPublic: data.isPublic !== undefined ? data.isPublic : true,
          owner: data.owner || '',
          createdAt: data.createdAt || new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          participants: 1
        };
        addRecentRoom(roomForStore);
        updateRoomAccess(roomId);
      }
        // Load canvas data if available
      if (data.canvasData) {
        console.log('📊 Loading canvas data:', data.canvasData);
        console.log('📊 Canvas data type:', typeof data.canvasData);
        console.log('📊 Canvas data keys:', Object.keys(data.canvasData || {}));
        setInitialCanvasData(data.canvasData);
      } else {
        console.log('📊 No canvas data found for this room');
        setInitialCanvasData(null);
      }        // Load participants if user is room owner
      if (data.owner === user?.uid) {
        loadParticipants();
      } else {
        // For non-owners, get their permission using the dedicated endpoint
        try {
          const permissionData = await getUserPermission(roomId);
          setCurrentUserPermission(permissionData.permission);
        } catch (error) {
          console.log('Could not load user permission, defaulting to view-only');
          setCurrentUserPermission('view');
        }
      }
      
    } catch (error) {
      console.error('Error loading room:', error);
      toast({
        title: "Error Loading Room",
        description: "Could not load room data. Redirecting to dashboard.",
        variant: "destructive",
      });
      setTimeout(() => navigate('/dashboard'), 2000);
    } finally {
      setIsLoadingRoom(false);
    }
  };

  const loadParticipants = async () => {
    if (!roomId || !isRoomOwner) return;
    
    try {
      const participantsData = await getRoomParticipants(roomId);
      setParticipants(participantsData);
      console.log('👥 Loaded participants:', participantsData);
    } catch (error) {
      console.error('Error loading participants:', error);
      toast({
        title: "Error Loading Participants",
        description: "Could not load participant data.",
        variant: "destructive",
      });
    }
  };

  const handleParticipantPermissionChange = async (participantId: string, newPermission: 'edit' | 'view') => {
    try {
      await updateParticipantPermission(roomId!, participantId, newPermission);
      
      // Update local state
      setParticipants(prev => 
        prev.map(p => p.id === participantId ? { ...p, permission: newPermission } : p)
      );
      
      toast({
        title: "Permission Updated",
        description: `Participant permission changed to ${newPermission}.`,
      });
      
      // Emit socket event to notify the participant
      socket.emit('permission-updated', { roomId, participantId, permission: newPermission });
      
    } catch (error) {
      console.error('Error updating participant permission:', error);
      toast({
        title: "Error Updating Permission",
        description: "Could not update participant permission.",
        variant: "destructive",
      });
    }
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };  const handleSaveRoom = async () => {
    if (!roomId || !canvasRef.current) return;
    
    try {
      // Get the current canvas state
      const canvasData = canvasRef.current.toJSON();
      
      await updateRoom(roomId, canvasData);
      
      toast({
        title: "Room Saved",
        description: "Your whiteboard has been saved successfully.",
      });
      
    } catch (error: any) {
      console.error('Error saving room:', error);
      
      // Check if it's a permission error (403 status)
      if (error.response?.status === 403) {
        toast({
          title: "Permission Denied",
          description: "Only the room owner can save changes to this whiteboard.",
          variant: "destructive",
        });
      } else if (error.response?.status === 404) {
        toast({
          title: "Room Not Found",
          description: "This room no longer exists.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error Saving Room",
          description: "Could not save room data. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleCopyRoomId = async () => {
    if (!roomId) return;
    
    try {
      await navigator.clipboard.writeText(roomId);
      setIsCopied(true);
      toast({
        title: "Room ID Copied!",
        description: "Room ID has been copied to clipboard. Share it with others to invite them.",
      });
      
      // Reset the copied state after 2 seconds
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy room ID:', error);
      toast({
        title: "Copy Failed",
        description: "Could not copy room ID. Please copy it manually.",
        variant: "destructive",
      });
    }
  };
  // Check if current user is the room owner
  const isRoomOwner = roomData && user && roomData.owner === user.uid;

  // Socket event handlers for participant updates
  useEffect(() => {
    if (roomId) {
      // Listen for participant join/leave events
      socket.on('participant-joined', (participantData) => {
        console.log('👥 Participant joined:', participantData);
        if (isRoomOwner) {
          setParticipants(prev => {
            // Check if participant already exists
            const exists = prev.some(p => p.id === participantData.id);
            if (!exists) {
              return [...prev, participantData];
            }
            return prev;
          });
        }
      });

      socket.on('participant-left', (participantId) => {
        console.log('👥 Participant left:', participantId);
        if (isRoomOwner) {
          setParticipants(prev => prev.filter(p => p.id !== participantId));
        }
      });      socket.on('participant-permission-updated', ({ participantId, permission }) => {
        console.log('👥 Participant permission updated:', { participantId, permission });
        
        // If this is the current user, update their permission
        if (user?.uid === participantId) {
          setCurrentUserPermission(permission);
          toast({
            title: "Permission Updated",
            description: `Your permission has been changed to ${permission}.`,
          });
        }
        
        if (isRoomOwner) {
          setParticipants(prev => 
            prev.map(p => p.id === participantId ? { ...p, permission } : p)
          );
        }
      });

      // Cleanup
      return () => {
        socket.off('participant-joined');
        socket.off('participant-left');
        socket.off('participant-permission-updated');
      };
    }
  }, [roomId, isRoomOwner]);

  
  return (
    <div className="h-screen flex flex-col bg-slate-50">      {/* Header with user info and logout */}
      <div className="bg-white shadow-sm border-b border-slate-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center space-x-4">
              {roomId && (
                <Button
                  onClick={handleBackToDashboard}
                  variant="ghost"
                  size="sm"
                  className="flex text-white items-center gap-1 text-xs px-2 py-1 h-8"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </Button>
              )}              <h1 className="text-lg font-medium text-slate-900">
                {roomId ? `Room: ${roomData?.roomName || roomId}` : 'Whiteboard'}
              </h1>
              {isLoadingRoom && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}              {/* Show Room ID for owner only */}
              {roomId && isRoomOwner && (
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-lg">
                  <span className="text-xs text-slate-600">Room ID:</span>
                  <code className="text-xs font-mono text-slate-800 bg-white px-2 py-1 rounded border">
                    {roomId}
                  </code>
                  <Button
                    onClick={handleCopyRoomId}
                    variant="ghost"
                    size="sm"
                    className="p-1 h-6 w-6 hover:bg-slate-200"
                    title="Copy Room ID"
                  >
                    {isCopied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-slate-500" />
                    )}
                  </Button>
                </div>
              )}
              
              {/* Show permission status for all users in rooms */}
              {roomId && (
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                  <span className="text-xs text-blue-600 font-medium">
                    {isRoomOwner ? (
                      <>
                        <Edit3 className="h-3 w-3 inline mr-1" />
                        Owner
                      </>
                    ) : (
                      <>
                        {currentUserPermission === 'edit' ? (
                          <>
                            <Edit3 className="h-3 w-3 inline mr-1" />
                            Edit Access
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3 inline mr-1" />
                            View Only
                          </>
                        )}
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>            <div className="flex items-center space-x-4">
              {roomId && isRoomOwner && (
                <>
                  <Button
                    onClick={handleSaveRoom}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 text-xs px-2 py-1 h-8"
                  >
                    Save Room
                  </Button>
                  <Dialog open={isParticipantsDialogOpen} onOpenChange={setIsParticipantsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-xs px-2 py-1 h-8"
                      >
                        <Users className="h-3 w-3" />
                        Participants ({participants.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Manage Participants</DialogTitle>
                        <DialogDescription>
                          Control participant access to this room
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {participants.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No participants have joined yet
                          </p>
                        ) : (
                          participants.map((participant) => (
                            <Card key={participant.id} className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium truncate">
                                        {participant.displayName || participant.email}
                                      </p>
                                      {participant.displayName && (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {participant.email}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <div className={`w-2 h-2 rounded-full ${participant.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                                      <span className="text-xs text-muted-foreground">
                                        {participant.isOnline ? 'Online' : 'Offline'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant={participant.permission === 'edit' ? 'default' : 'secondary'} className="text-xs">
                                      {participant.permission === 'edit' ? (
                                        <>
                                          <Edit3 className="h-3 w-3 mr-1" />
                                          Edit
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="h-3 w-3 mr-1" />
                                          View Only
                                        </>
                                      )}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Joined {new Date(participant.joinedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="ml-3">
                                  <Select
                                    value={participant.permission}
                                    onValueChange={(value: 'edit' | 'view') => 
                                      handleParticipantPermissionChange(participant.id, value)
                                    }
                                  >
                                    <SelectTrigger className="w-24 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="edit">
                                        <div className="flex items-center gap-1">
                                          <Edit3 className="h-3 w-3" />
                                          Edit
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="view">
                                        <div className="flex items-center gap-1">
                                          <Eye className="h-3 w-3" />
                                          View
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </Card>
                          ))
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
              <span className="text-sm text-slate-600">
                {user?.email || user?.displayName || 'User'}
              </span>
              <Button
                onClick={logout}
                variant="outline"
                size="sm"
                className="flex items-center gap-1 text-xs px-2 py-1 h-8"
              >
                <LogOut className="h-3 w-3" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-shrink-0">
        <Toolbar
          activeTool={state.activeTool}
          strokeColor={state.strokeColor}
          strokeWidth={state.strokeWidth}
          fillColor={state.fillColor}
          opacity={state.opacity}
          onToolChange={setActiveTool}
          onStrokeColorChange={setStrokeColor}
          onStrokeWidthChange={setStrokeWidth}
          onFillColorChange={setFillColor}
          onOpacityChange={setOpacity}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          onExport={handleExport}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </div>        <div className="flex-1 min-h-0">        <Canvas
          ref={canvasRef}
          roomId={roomId}
          activeTool={state.activeTool}
          strokeColor={state.strokeColor}
          strokeWidth={state.strokeWidth}
          fillColor={state.fillColor}
          opacity={state.opacity}
          onHistoryChange={handleHistoryChange}
          onUndo={undoState}
          onRedo={redoState}
          onClear={shouldClear}
          onExport={shouldExport}          resetClear={resetClear}
          resetExport={resetExport}
          initialCanvasData={initialCanvasData}
          userPermission={isRoomOwner ? 'edit' : currentUserPermission}
        />
      </div>
    </div>

  );
}

export default HomePage;
