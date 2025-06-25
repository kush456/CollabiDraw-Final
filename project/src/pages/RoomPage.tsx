import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Globe, Lock, Users, Clock, LogOut, Loader2 } from 'lucide-react';
import { saveRoom, joinRoom, getUserRooms } from '@/api/room';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRoomsStore } from '@/stores/useRoomsStore';
import { useNavigate } from 'react-router-dom';

interface Room {
  id: string;
  roomId: string;
  roomName: string;
  isPublic: boolean;
  owner: string;
  createdAt: string;
  lastAccessed?: string;
  participants?: number;
}

export default function RoomPage(){
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<'public' | 'private'>('public');
  const [roomPassword, setRoomPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Join room states
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinRoomType, setJoinRoomType] = useState<'public' | 'private'>('public');
  const [joinRoomPassword, setJoinRoomPassword] = useState('');  
  const [isJoining, setIsJoining] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  
  const { toast } = useToast();
  const { user, logout } = useAuthStore();
  const { recentRooms, addRecentRoom, setUserRooms } = useRoomsStore();
  const navigate = useNavigate();

  // Load user's rooms on component mount
  useEffect(() => {
    const loadUserRooms = async () => {
      try {
        setIsLoadingRooms(true);
        const rooms = await getUserRooms();
        setUserRooms(rooms);
      } catch (error) {
        console.error('Error loading user rooms:', error);
        toast({
          title: "Error",
          description: "Failed to load your rooms.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingRooms(false);
      }
    };

    loadUserRooms();
  }, [setUserRooms, toast]);

  const handleCreateRoom = async () => {
    try {
      setIsCreating(true);
      
      // Validate password for private rooms
      if (roomType === 'private' && !roomPassword.trim()) {
        toast({
          title: "Password Required",
          description: "Please set a password for private rooms.",
          variant: "destructive",
        });
        return;
      }
      
      // Create room data object with the room metadata
      const roomData = {
        roomName: roomName || 'Untitled Room',
        isPublic: roomType === 'public',
        password: roomType === 'private' ? roomPassword : undefined,
        canvasData: {} // Empty canvas data for new room
      };

      console.log('Creating room:', roomData);
      
      const response = await saveRoom(roomData);
        toast({
        title: "Room Created Successfully!",
        description: `Room "${roomData.roomName}" has been created.`,
      });
      
      // Add the new room to recent rooms
      const newRoom: Room = {
        id: response.roomId,
        roomId: response.roomId,
        roomName: roomData.roomName,
        isPublic: roomData.isPublic,
        owner: user?.uid || '',
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        participants: 1
      };
      addRecentRoom(newRoom);
      
      // Clear form after successful creation
      setRoomName('');
      setRoomPassword('');
      setRoomType('public');
      console.log('Room created with ID:', response.roomId);
      
      // Navigate to the room canvas
      navigate(`/room/${response.roomId}`);
      
    } catch (error: any) {
      console.error('Error creating room:', error);
      
      let errorMessage = "There was an error creating the room. Please try again.";
      let errorTitle = "Error Creating Room";
      
      if (error.response?.status === 400) {
        if (error.response.data?.error?.includes("Password is required")) {
          errorTitle = "Password Required";
          errorMessage = "Please set a password for private rooms.";
        } else if (error.response.data?.error?.includes("canvas data")) {
          errorTitle = "Invalid Data";
          errorMessage = "There was an issue with the room data. Please try again.";
        } else {
          errorMessage = error.response.data?.error || errorMessage;
        }
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }  };

  const handleJoinRoom = async () => {
    try {
      setIsJoining(true);
      
      if (!joinRoomId.trim()) {
        toast({
          title: "Room ID Required",
          description: "Please enter a room ID to join.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate password for private rooms
      if (joinRoomType === 'private' && !joinRoomPassword.trim()) {
        toast({
          title: "Password Required",
          description: "Please enter the room password.",
          variant: "destructive",
        });
        return;
      }
      
      const joinData = {
        roomId: joinRoomId,
        isPublic: joinRoomType === 'public',
        password: joinRoomType === 'private' ? joinRoomPassword : undefined,
      };

      console.log('Joining room:', joinData);
      
      const response = await joinRoom(joinData);
      
      toast({
        title: "Joined Room Successfully!",        description: `You have joined "${response.roomName}".`,
      });
      
      // Add the joined room to recent rooms
      const joinedRoom: Room = {
        id: response.roomId || joinRoomId,
        roomId: response.roomId || joinRoomId,
        roomName: response.roomName || 'Unnamed Room',
        isPublic: response.isPublic !== undefined ? response.isPublic : joinRoomType === 'public',
        owner: response.owner || '',
        createdAt: response.createdAt || new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        participants: 1
      };
      addRecentRoom(joinedRoom);
      
      // Clear form after successful join
      setJoinRoomId('');
      setJoinRoomPassword('');
      setJoinRoomType('public');
      console.log('Joined room:', response);
      
      // Navigate to the room canvas
      navigate(`/room/${joinRoomId}`);
      
    } catch (error: any) {
      console.error('Error joining room:', error);
      
      let errorMessage = "There was an error joining the room. Please try again.";
      let errorTitle = "Error Joining Room";
      
      if (error.response?.status === 404) {
        errorTitle = "Room Not Found";
        errorMessage = "The room ID you entered does not exist. Please check and try again.";
      } else if (error.response?.status === 401) {
        errorTitle = "Incorrect Password";
        errorMessage = "The password you entered is incorrect. Please try again.";
      } else if (error.response?.status === 400) {
        if (error.response.data?.error?.includes("private")) {
          errorTitle = "Room Type Mismatch";
          errorMessage = "This room is private. Please select 'Private' and enter the password.";
        } else if (error.response.data?.error?.includes("public")) {
          errorTitle = "Room Type Mismatch";
          errorMessage = "This room is public. Please select 'Public' to join.";
        } else {
          errorMessage = error.response.data?.error || errorMessage;
        }
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });    } finally {
      setIsJoining(false);
    }
  };

  // Helper function to format last accessed time
  const formatLastAccessed = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header with user info and logout */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-slate-900">
                Collaborative Whiteboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600">
                Welcome, {user?.email || user?.displayName || 'User'}
              </span>
              <Button
                onClick={logout}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)] w-full">
        <div className="container px-4 py-8 mx-auto">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-slate-900 mb-3">
                Collaborative Whiteboard
              </h1>
              <p className="text-lg text-slate-600">
                Draw, collaborate, and create together in real-time
              </p>
            </div>

            {/* Main Cards */}
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Create New Room */}
              <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Plus className="h-5 w-5 text-blue-600" />
                    </div>
                    Create New Room
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Start a new collaborative whiteboard session
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Input
                      placeholder="Room name (optional)"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      className="border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  {/* Room Type Toggle */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={roomType === 'public' ? 'default' : 'outline'}
                        onClick={() => setRoomType('public')}
                        className={`justify-start gap-2 h-12 ${
                          roomType === 'public'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Globe className="h-4 w-4" />
                        Public
                      </Button>
                      <Button
                        variant={roomType === 'private' ? 'default' : 'outline'}
                        onClick={() => setRoomType('private')}
                        className={`justify-start gap-2 h-12 ${
                          roomType === 'private'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Lock className="h-4 w-4" />
                        Private
                      </Button>
                    </div>
                    <p className="text-sm text-slate-500">
                      {roomType === 'public' 
                        ? 'Anyone with the link can join and edit'
                        : 'Only people with the password can join'
                      }
                    </p>
                  </div>

                  {/* Password field for private rooms */}
                  {roomType === 'private' && (
                    <div>
                      <Input
                        type="password"
                        placeholder="Set room password"
                        value={roomPassword}
                        onChange={(e) => setRoomPassword(e.target.value)}
                        className="border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <Button
                    onClick={handleCreateRoom}
                    disabled={isCreating}
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {isCreating ? 'Creating Room...' : 'Create Room'}
                  </Button>
                </CardContent>
              </Card>

              {/* Join Existing Room */}
              <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">Join Existing Room</CardTitle>
                  <CardDescription className="text-slate-600">
                    Enter a room ID to join an existing session
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Input
                      placeholder="Enter room ID"
                      value={joinRoomId}
                      onChange={(e) => setJoinRoomId(e.target.value)}
                      className="border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  {/* Room Type Toggle for Join */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={joinRoomType === 'public' ? 'default' : 'outline'}
                        onClick={() => setJoinRoomType('public')}
                        className={`justify-start gap-2 h-12 ${
                          joinRoomType === 'public'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Globe className="h-4 w-4" />
                        Public
                      </Button>
                      <Button
                        variant={joinRoomType === 'private' ? 'default' : 'outline'}
                        onClick={() => setJoinRoomType('private')}
                        className={`justify-start gap-2 h-12 ${
                          joinRoomType === 'private'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Lock className="h-4 w-4" />
                        Private
                      </Button>
                    </div>
                    <p className="text-sm text-slate-500">
                      {joinRoomType === 'public' 
                        ? 'Public rooms are open to everyone'
                        : 'Private rooms require a password'
                      }
                    </p>
                  </div>

                  {/* Password field for private rooms */}
                  {joinRoomType === 'private' && (
                    <div>
                      <Input
                        type="password"
                        placeholder="Enter room password"
                        value={joinRoomPassword}
                        onChange={(e) => setJoinRoomPassword(e.target.value)}
                        className="border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <Button
                    onClick={handleJoinRoom}
                    disabled={isJoining || !joinRoomId.trim()}
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {isJoining ? 'Joining Room...' : 'Join Room'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Recent Rooms */}
            <Card className="bg-white shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-xl">Recent Rooms</CardTitle>
                <CardDescription className="text-slate-600">
                  Your recently accessed whiteboard sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {isLoadingRooms ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                      <span className="ml-2 text-slate-600">Loading rooms...</span>
                    </div>
                  ) : recentRooms.length > 0 ? (
                    recentRooms.map((room: Room) => (
                      <div
                        key={room.roomId}
                        className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
                        onClick={() => {
                          addRecentRoom(room);
                          navigate(`/room/${room.roomId}`);
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            {!room.isPublic ? (
                              <Lock className="h-4 w-4 text-slate-600" />
                            ) : (
                              <Globe className="h-4 w-4 text-slate-600" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-slate-900">{room.roomName}</h3>
                              <Badge
                                variant={!room.isPublic ? 'secondary' : 'default'}
                                className={`text-xs ${
                                  !room.isPublic ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {room.isPublic ? 'Public' : 'Private'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-500">
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{room.participants || 1} participants</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{formatLastAccessed(room.lastAccessed || room.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <p>No recent rooms found</p>
                      <p className="text-sm mt-1">Create or join a room to get started</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

