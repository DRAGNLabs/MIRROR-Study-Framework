// deleteCompletedRoomFlow.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteCompletedRoomFlow } from "../admin/DeleteCompletedRoom";

describe("deleteCompletedRoomFlow", () => {
  let deleteUser;
  let deleteSurvey;
  let getAllSurveys;
  let closeARoom;
  let setRooms;
  let setCompletedRoomList;
  let setRoomPendingDelete;

  const roomPendingDelete = {
    roomCode: 1234,
    userIds: [1, 2, 3],
  };

  beforeEach(() => {
    deleteUser = vi.fn().mockResolvedValue({});
    deleteSurvey = vi.fn().mockResolvedValue({
      message: "Survey deleted successfully",
    });
    getAllSurveys = vi.fn().mockResolvedValue([]);
    closeARoom = vi.fn().mockResolvedValue({
      message: "Room deleted successfully",
    });
    setRooms = vi.fn();
    setCompletedRoomList = vi.fn();
    setRoomPendingDelete = vi.fn();

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns immediately if roomPendingDelete is null", async () => {
    await deleteCompletedRoomFlow({
      roomPendingDelete: null,
      deleteUser,
      deleteSurvey,
      getAllSurveys,
      closeARoom,
      setRooms,
      setCompletedRoomList,
      setRoomPendingDelete,
    });

    expect(deleteUser).not.toHaveBeenCalled();
    expect(deleteSurvey).not.toHaveBeenCalled();
    expect(closeARoom).not.toHaveBeenCalled();
    expect(setRooms).not.toHaveBeenCalled();
    expect(setCompletedRoomList).not.toHaveBeenCalled();
    expect(setRoomPendingDelete).not.toHaveBeenCalled();
  });

  it("deletes all users, surveys, and room, then updates state", async () => {
    await deleteCompletedRoomFlow({
      roomPendingDelete,
      deleteUser,
      deleteSurvey,
      getAllSurveys,
      closeARoom,
      setRooms,
      setCompletedRoomList,
      setRoomPendingDelete,
    });

    expect(deleteUser).toHaveBeenCalledTimes(3);
    expect(deleteUser).toHaveBeenNthCalledWith(1, 1);
    expect(deleteUser).toHaveBeenNthCalledWith(2, 2);
    expect(deleteUser).toHaveBeenNthCalledWith(3, 3);

    expect(deleteSurvey).toHaveBeenCalledWith(1234);
    expect(getAllSurveys).toHaveBeenCalledTimes(1);
    expect(closeARoom).toHaveBeenCalledWith(1234);

    expect(setRooms).toHaveBeenCalledTimes(1);
    expect(setCompletedRoomList).toHaveBeenCalledTimes(1);
    expect(setRoomPendingDelete).toHaveBeenCalledWith(null);
  });

  it("continues deleting even if one user delete fails", async () => {
    deleteUser
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("Failed to delete user 2"))
      .mockResolvedValueOnce({});

    await deleteCompletedRoomFlow({
      roomPendingDelete,
      deleteUser,
      deleteSurvey,
      getAllSurveys,
      closeARoom,
      setRooms,
      setCompletedRoomList,
      setRoomPendingDelete,
    });

    expect(deleteUser).toHaveBeenCalledTimes(3);
    expect(deleteSurvey).toHaveBeenCalledWith(1234);
    expect(closeARoom).toHaveBeenCalledWith(1234);
    expect(setRoomPendingDelete).toHaveBeenCalledWith(null);

    expect(console.error).toHaveBeenCalled();
  });

  it("throws if deleteSurvey fails and does not delete room", async () => {
    deleteSurvey.mockRejectedValue(new Error("Survey delete failed"));

    await expect(
      deleteCompletedRoomFlow({
        roomPendingDelete,
        deleteUser,
        deleteSurvey,
        getAllSurveys,
        closeARoom,
        setRooms,
        setCompletedRoomList,
        setRoomPendingDelete,
      })
    ).rejects.toThrow("Survey delete failed");

    expect(closeARoom).not.toHaveBeenCalled();
    expect(setRooms).not.toHaveBeenCalled();
    expect(setCompletedRoomList).not.toHaveBeenCalled();
    expect(setRoomPendingDelete).not.toHaveBeenCalledWith(null);
  });

  it("filters the deleted room out of rooms state", async () => {
    await deleteCompletedRoomFlow({
      roomPendingDelete,
      deleteUser,
      deleteSurvey,
      getAllSurveys,
      closeARoom,
      setRooms,
      setCompletedRoomList,
      setRoomPendingDelete,
    });

    const setRoomsCallback = setRooms.mock.calls[0][0];
    const prevRooms = [
      { roomCode: 1234, name: "delete me" },
      { roomCode: 5678, name: "keep me" },
    ];

    const result = setRoomsCallback(prevRooms);

    expect(result).toEqual([{ roomCode: 5678, name: "keep me" }]);
  });

  it("filters the deleted room out of completedRoomList state", async () => {
    await deleteCompletedRoomFlow({
      roomPendingDelete,
      deleteUser,
      deleteSurvey,
      getAllSurveys,
      closeARoom,
      setRooms,
      setCompletedRoomList,
      setRoomPendingDelete,
    });

    const setCompletedCallback = setCompletedRoomList.mock.calls[0][0];
    const prevCompletedRooms = [
      { roomCode: 1234, name: "delete me" },
      { roomCode: 5678, name: "keep me" },
    ];

    const result = setCompletedCallback(prevCompletedRooms);

    expect(result).toEqual([{ roomCode: 5678, name: "keep me" }]);
  });
});