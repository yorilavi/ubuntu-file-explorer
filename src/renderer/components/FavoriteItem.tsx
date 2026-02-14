import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FavoriteItemProps {
  id: string;
  path: string;
  onNavigate: () => void;
  onRemove: () => void;
}

/**
 * Draggable favorite item for sidebar.
 * Shows folder name, click to navigate, drag to reorder.
 */
export function FavoriteItem({ id, path, onNavigate, onRemove }: FavoriteItemProps): React.JSX.Element {
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
    opacity: isDragging ? 0.5 : 1,
  };

  // Extract folder name from path
  const folderName = path.split('/').filter(Boolean).pop() || '/';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`favorite-item ${isDragging ? 'favorite-item--dragging' : ''}`}
      {...attributes}
    >
      {/* Drag handle on left */}
      <span className="favorite-item__handle" data-tooltip="Drag to reorder" data-tooltip-pos="right" {...listeners}>
        ⋮⋮
      </span>

      {/* Folder icon and name - clickable */}
      <button
        className="favorite-item__content"
        onClick={onNavigate}
        data-tooltip={path}
        data-tooltip-pos="bottom"
      >
        <span className="favorite-item__icon">📁</span>
        <span className="favorite-item__name">{folderName}</span>
      </button>

      {/* Remove button */}
      <button
        className="favorite-item__remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        data-tooltip="Remove from favorites"
      >
        ×
      </button>
    </div>
  );
}
