import { allUsers } from "../../services/usersService";
import { getCreatedRooms } from "../../services/roomsService";

export async function deleteCompletedRoomFlow({
  roomPendingDelete,
  deleteUser,
  deleteSurvey,
  getAllSurveys,
  closeARoom,
  setRooms,
  setCompletedRoomList,
  setRoomPendingDelete
}) {
  if (!roomPendingDelete) return;

  const roomCodeToDelete = roomPendingDelete.roomCode;
  const userIds = roomPendingDelete.userIds || [];

  const users = await allUsers();
  console.log("All users before:", users);

  for (const userId of userIds) {
    try {
      await deleteUser(userId);
    } catch (error) {
      console.error(`Failed to delete user ${userId}:`, error);
    }
  }

  const usersAfter = await allUsers();
  console.log("All users after:", usersAfter);


  const surveys = await getAllSurveys();
  console.log("Survey Start", surveys);

  const surveysForRoom = surveys.filter(
    (survey) => Number(survey.roomCode) === Number(roomCodeToDelete)
  );

  if (surveysForRoom.length > 0) {
    await deleteSurvey(roomCodeToDelete);
  } else {
    console.log(`No surveys found for room ${roomCodeToDelete}, skipping survey delete.`);
  }

  const surveysLeft = await getAllSurveys();
  console.log("Surveys Now:", surveysLeft);

  const roomsNow = await getCreatedRooms();
  console.log("Getting open rooms:", roomsNow);
  await closeARoom(roomCodeToDelete);
  const roomsAfter = await getCreatedRooms();
  console.log("Getting open rooms:", roomsAfter);

  setRooms((prev) => prev.filter((r) => r.roomCode !== roomCodeToDelete));
  setCompletedRoomList((prev) =>
    prev.filter((r) => r.roomCode !== roomCodeToDelete)
  );
  setRoomPendingDelete(null);
}