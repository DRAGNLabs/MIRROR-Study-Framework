import { useMemo } from "react";
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function sortRankItemId(questionId, option) {
    return `${questionId}|||${encodeURIComponent(option)}`;
}

function SortableRow({ id, index, label, isGreyed }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`sort-rank-item ${isGreyed ? "sort-rank-item--greyed" : ""} ${isDragging ? "sort-rank-item--dragging" : ""}`}
            {...attributes}
            {...listeners}
        >
            <span className="sort-rank-item-drag-handle" aria-hidden>
                ::
            </span>
            <span className="sort-rank-item-label">
                {index + 1}. {label}
            </span>
        </li>
    );
}

export function SortRankList({ questionId, options, onOrderChange }) {
    const itemIds = useMemo(
        () => options.map((opt) => sortRankItemId(questionId, opt)),
        [questionId, options]
    );

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    function handleDragEnd(event) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = itemIds.indexOf(active.id);
        const newIndex = itemIds.indexOf(over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const next = arrayMove(options, oldIndex, newIndex);
        onOrderChange(next);
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <ul className="sort-rank-list">
                    {options.map((option, index) => (
                        <SortableRow
                            key={sortRankItemId(questionId, option)}
                            id={sortRankItemId(questionId, option)}
                            index={index}
                            label={option}
                            isGreyed={index >= 3}
                        />
                    ))}
                </ul>
            </SortableContext>
            <div className="sort-rank-anchor" aria-hidden>
                <span className="sort-rank-anchor-inner">&nbsp;</span>
            </div>
        </DndContext>
    );
}
