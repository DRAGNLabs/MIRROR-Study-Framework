// src/tests/deleteCompletedRoomFlow.dbshape.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteCompletedRoomFlow } from "../admin/DeleteCompletedRoom";


describe("deleteCompletedRoomFlow using mocked data shaped like real DB tables", () => {
  let deleteUser;
  let deleteSurvey;
  let closeARoom;
  let getAllSurveys;
  let setRooms;
  let setCompletedRoomList;
  let setRoomPendingDelete;

  const mockRoomRow = {
    roomCode: 4444,
    gameType: 1,
    numRounds: 3,
    usersNeeded: 3,
    modelType: "default",
    started: true,
    userIds: [101, 102, 103],
    userMessages: {},
    llmInstructions: {},
    llmResponse: {},
    status: "survey",
    completed: true,
    resourceAllocations: {},
    fish_amount: { "1": 100 },
  };

  const mockUserTableRows = [
    { userId: 101, userName: "Andy", roomCode: 4444, role: 0 },
    { userId: 102, userName: "Beth", roomCode: 4444, role: 0 },
    { userId: 103, userName: "Chris", roomCode: 4444, role: 1 },
  ];

  const mockSurveyTableRows = [
    { roomCode: 4444, userId: 101, data: { age: 21 } },
    { roomCode: 4444, userId: 102, data: { age: 22 } },
    { roomCode: 4444, userId: 103, data: { age: 23 } },
  ];

  beforeEach(() => {
    deleteUser = vi.fn(async (userId) => {
      const deletedUser = mockUserTableRows.find((u) => u.userId === userId);

      if (!deletedUser) {
        throw new Error(`No user found for userId ${userId}`);
      }

      return {
        message: "User deleted successfully",
        deletedUser,
      };
    });

    deleteSurvey = vi.fn(async (roomCode) => {
      const deletedSurvey = mockSurveyTableRows.filter(
        (s) => s.roomCode === roomCode
      );

      if (deletedSurvey.length === 0) {
        throw new Error(`No survey found for roomCode ${roomCode}`);
      }

      return {
        message: "Survey deleted successfully",
        deletedSurvey,
      };
    });

    closeARoom = vi.fn(async (roomCode) => {
      if (roomCode !== mockRoomRow.roomCode) {
        throw new Error(`No room found for roomCode ${roomCode}`);
      }

      return {
        message: "Room deleted successfully",
        deletedRoom: mockRoomRow,
      };
    });

    getAllSurveys = vi.fn(async () => []);

    setRooms = vi.fn();
    setCompletedRoomList = vi.fn();
    setRoomPendingDelete = vi.fn();

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("calls deletion methods for rows matching the real DB schema", async () => {
    await deleteCompletedRoomFlow({
      roomPendingDelete: mockRoomRow,
      deleteUser,
      deleteSurvey,
      getAllSurveys,
      closeARoom,
      setRooms,
      setCompletedRoomList,
      setRoomPendingDelete,
    });

    expect(deleteUser).toHaveBeenCalledTimes(3);
    expect(deleteUser).toHaveBeenNthCalledWith(1, 101);
    expect(deleteUser).toHaveBeenNthCalledWith(2, 102);
    expect(deleteUser).toHaveBeenNthCalledWith(3, 103);

    expect(deleteSurvey).toHaveBeenCalledTimes(1);
    expect(deleteSurvey).toHaveBeenCalledWith(4444);

    expect(closeARoom).toHaveBeenCalledTimes(1);
    expect(closeARoom).toHaveBeenCalledWith(4444);

    expect(getAllSurveys).toHaveBeenCalledTimes(1);
    expect(setRoomPendingDelete).toHaveBeenCalledWith(null);
  });

  it("removes the room from rooms state", async () => {
    await deleteCompletedRoomFlow({
      roomPendingDelete: mockRoomRow,
      deleteUser,
      deleteSurvey,
      getAllSurveys,
      closeARoom,
      setRooms,
      setCompletedRoomList,
      setRoomPendingDelete,
    });

    const updateRoomsFn = setRooms.mock.calls[0][0];

    const currentRooms = [
      mockRoomRow,
      {
        roomCode: 9999,
        gameType: 1,
        numRounds: 2,
        usersNeeded: 2,
        modelType: "default",
        started: false,
        userIds: [],
        userMessages: {},
        llmInstructions: {},
        llmResponse: {},
        status: "waiting",
        completed: false,
        resourceAllocations: {},
        fish_amount: { "1": 100 },
      },
    ];

    const updatedRooms = updateRoomsFn(currentRooms);

    expect(updatedRooms).toEqual([
      {
        roomCode: 9999,
        gameType: 1,
        numRounds: 2,
        usersNeeded: 2,
        modelType: "default",
        started: false,
        userIds: [],
        userMessages: {},
        llmInstructions: {},
        llmResponse: {},
        status: "waiting",
        completed: false,
        resourceAllocations: {},
        fish_amount: { "1": 100 },
      },
    ]);
  });

  it("removes the room from completedRoomList state", async () => {
    await deleteCompletedRoomFlow({
      roomPendingDelete: mockRoomRow,
      deleteUser,
      deleteSurvey,
      getAllSurveys,
      closeARoom,
      setRooms,
      setCompletedRoomList,
      setRoomPendingDelete,
    });

    const updateCompletedFn = setCompletedRoomList.mock.calls[0][0];

    const completedRooms = [
      mockRoomRow,
      {
        roomCode: 8888,
        completed: true,
        userIds: [201, 202],
      },
    ];

    const updatedCompleted = updateCompletedFn(completedRooms);

    expect(updatedCompleted).toEqual([
      {
        roomCode: 8888,
        completed: true,
        userIds: [201, 202],
      },
    ]);
  });

  it("does not delete room if survey deletion fails", async () => {
    deleteSurvey = vi
      .fn()
      .mockRejectedValue(new Error("Survey delete failed"));

    await expect(
      deleteCompletedRoomFlow({
        roomPendingDelete: mockRoomRow,
        deleteUser,
        deleteSurvey,
        getAllSurveys,
        closeARoom,
        setRooms,
        setCompletedRoomList,
        setRoomPendingDelete,
      })
    ).rejects.toThrow("Survey delete failed");

    expect(deleteUser).toHaveBeenCalledTimes(3);
    expect(closeARoom).not.toHaveBeenCalled();
    expect(setRooms).not.toHaveBeenCalled();
    expect(setCompletedRoomList).not.toHaveBeenCalled();
  });
});