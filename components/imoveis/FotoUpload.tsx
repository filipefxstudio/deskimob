"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import imageCompression from "browser-image-compression";
import { GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FOTO_COMPRESS_CLIENT_OPTIONS,
  FOTO_MAX_BYTES,
  FOTO_MAX_BYTES_LABEL,
  FOTO_MAX_HEIGHT,
  FOTO_MAX_WIDTH,
} from "@/lib/imoveis/foto-compress.constants";
import { cn } from "@/lib/utils";

export interface FotoItem {
  id: string;
  file?: File;
  existingId?: string;
  previewUrl: string;
  legenda: string;
  ordem: number;
}

interface FotoUploadProps {
  fotos: FotoItem[];
  onChange: (fotos: FotoItem[]) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const COMPRESSIBLE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const GRID_ITEM_WIDTH = 132;

const COMPRESSION_ATTEMPTS = [
  FOTO_COMPRESS_CLIENT_OPTIONS,
  {
    ...FOTO_COMPRESS_CLIENT_OPTIONS,
    maxSizeMB: 0.15,
    initialQuality: 0.75,
    maxWidthOrHeight: FOTO_MAX_WIDTH,
  },
  {
    ...FOTO_COMPRESS_CLIENT_OPTIONS,
    maxSizeMB: 0.12,
    initialQuality: 0.65,
    maxWidthOrHeight: 1024,
  },
] as const;

async function compressImageFile(file: File): Promise<File> {
  let best: File = file;

  for (const options of COMPRESSION_ATTEMPTS) {
    const compressed = await imageCompression(file, options);
    best = new File([compressed], file.name, {
      type: compressed.type || file.type,
      lastModified: Date.now(),
    });

    if (compressed.size <= FOTO_MAX_BYTES) {
      return best;
    }
  }

  return best;
}

function reorderFotos(fotos: FotoItem[]): FotoItem[] {
  return fotos.map((foto, index) => ({ ...foto, ordem: index }));
}

function createFotoItem(file: File, ordem: number): FotoItem {
  return {
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
    legenda: "",
    ordem,
  };
}

interface SortableFotoItemProps {
  foto: FotoItem;
  index: number;
  disabled?: boolean;
  onRemove: (id: string) => void;
  onLegendaChange: (id: string, legenda: string) => void;
}

function SortableFotoItem({
  foto,
  index,
  disabled,
  onRemove,
  onLegendaChange,
}: SortableFotoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: foto.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: GRID_ITEM_WIDTH,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "shrink-0 space-y-2 rounded-xl border border-border bg-card p-2",
        isDragging && "opacity-40",
      )}
    >
      <div className="relative h-[90px] overflow-hidden rounded-lg bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={foto.previewUrl}
          alt={foto.legenda || `Foto ${index + 1}`}
          className="size-full object-cover"
        />
        {index === 0 ? (
          <span className="absolute bottom-0 left-0 right-0 bg-primary/90 px-1 py-0.5 text-center text-[10px] font-medium text-primary-foreground">
            Capa
          </span>
        ) : null}
        <div className="absolute right-1 top-1 flex gap-1">
          <button
            type="button"
            className="cursor-grab rounded bg-background/90 p-1 text-muted-foreground active:cursor-grabbing"
            aria-label="Reordenar foto"
            {...attributes}
            {...listeners}
            disabled={disabled}
          >
            <GripVertical className="size-3.5" />
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 bg-background/90 text-destructive hover:text-destructive"
            onClick={() => onRemove(foto.id)}
            disabled={disabled}
            aria-label="Remover foto"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <Input
        placeholder="Legenda"
        value={foto.legenda}
        onChange={(event) => onLegendaChange(foto.id, event.target.value)}
        disabled={disabled}
        className="text-xs"
      />
    </li>
  );
}

function FotoOverlayItem({ foto, index }: { foto: FotoItem; index: number }) {
  return (
    <li
      style={{ width: GRID_ITEM_WIDTH }}
      className="shrink-0 space-y-2 rounded-xl border border-border bg-card p-2 shadow-md"
    >
      <div className="relative h-[90px] overflow-hidden rounded-lg bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={foto.previewUrl}
          alt={foto.legenda || `Foto ${index + 1}`}
          className="size-full object-cover"
        />
        {index === 0 ? (
          <span className="absolute bottom-0 left-0 right-0 bg-primary/90 px-1 py-0.5 text-center text-[10px] font-medium text-primary-foreground">
            Capa
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function FotoUpload({ fotos, onChange, disabled }: FotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const fotosRef = useRef(fotos);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);

  useEffect(() => {
    return () => {
      for (const foto of fotosRef.current) {
        if (foto.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(foto.previewUrl);
        }
      }
    };
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setIsCompressing(true);
      setError(null);

      const nextFotos = [...fotos];
      const errors: string[] = [];
      const warnings: string[] = [];

      try {
        for (const file of Array.from(files)) {
          if (!ACCEPTED_TYPES.includes(file.type)) {
            errors.push(`${file.name}: formato não suportado.`);
            continue;
          }

          if (file.size > MAX_FILE_SIZE) {
            errors.push(`${file.name}: arquivo maior que 10 MB.`);
            continue;
          }

          let processedFile = file;

          if (COMPRESSIBLE_TYPES.includes(file.type)) {
            try {
              processedFile = await compressImageFile(file);
              if (processedFile.size > FOTO_MAX_BYTES) {
                warnings.push(
                  `${file.name}: ainda acima de ${FOTO_MAX_BYTES_LABEL} após compressão.`,
                );
              }
            } catch {
              warnings.push(
                `${file.name}: não foi possível comprimir. Usando arquivo original.`,
              );
              processedFile = file;
            }
          }

          nextFotos.push(createFotoItem(processedFile, nextFotos.length));
        }

        const messages = [...errors, ...warnings];

        if (messages.length > 0) {
          setError(messages.join(" "));
        }

        onChange(reorderFotos(nextFotos));
      } finally {
        setIsCompressing(false);
      }
    },
    [fotos, onChange],
  );

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) {
      void addFiles(event.target.files);
      event.target.value = "";
    }
  }

  function handleRemove(id: string) {
    const removed = fotos.find((foto) => foto.id === id);

    if (removed?.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(removed.previewUrl);
    }

    onChange(reorderFotos(fotos.filter((foto) => foto.id !== id)));
    setError(null);
  }

  function handleLegendaChange(id: string, legenda: string) {
    onChange(fotos.map((foto) => (foto.id === id ? { ...foto, legenda } : foto)));
  }

  function handleSortDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleSortDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = fotos.findIndex((foto) => foto.id === active.id);
    const newIndex = fotos.findIndex((foto) => foto.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    onChange(reorderFotos(arrayMove(fotos, oldIndex, newIndex)));
  }

  function handleSortDragCancel() {
    setActiveId(null);
  }

  function handleFileDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleFileDragEnter(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!disabled && !isCompressing) {
      setIsDragOver(true);
    }
  }

  function handleFileDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  function handleFileDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    if (disabled || isCompressing) {
      return;
    }

    const files = event.dataTransfer.files;

    if (files.length > 0) {
      void addFiles(files);
    }
  }

  const activeFoto = activeId ? fotos.find((foto) => foto.id === activeId) : null;
  const activeIndex = activeFoto ? fotos.indexOf(activeFoto) : -1;

  return (
    <div className="space-y-4">
      <div>
        <Label>Fotos do imóvel</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie JPG, PNG ou WebP (até 10 MB cada). As fotos são comprimidas
          automaticamente para até {FOTO_MAX_BYTES_LABEL} (máx. {FOTO_MAX_WIDTH}×
          {FOTO_MAX_HEIGHT}) antes do envio. Arraste para reordenar.
        </p>
      </div>

      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/30",
          (disabled || isCompressing) && "pointer-events-none opacity-50",
        )}
        onDragOver={handleFileDragOver}
        onDragEnter={handleFileDragEnter}
        onDragLeave={handleFileDragLeave}
        onDrop={handleFileDrop}
      >
        {isCompressing ? (
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="size-8 text-muted-foreground" />
        )}
        <p className="mt-2 text-sm font-medium">
          {isCompressing ? "Comprimindo fotos…" : "Adicionar fotos"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isCompressing
            ? "Aguarde enquanto otimizamos os arquivos"
            : "Clique ou arraste arquivos para esta área"}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isCompressing}
        >
          {isCompressing ? "Comprimindo…" : "Selecionar arquivos"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled || isCompressing}
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {fotos.length > 0 ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleSortDragStart}
          onDragEnd={handleSortDragEnd}
          onDragCancel={handleSortDragCancel}
        >
          <SortableContext
            items={fotos.map((foto) => foto.id)}
            strategy={rectSortingStrategy}
          >
            <ul className="flex flex-wrap gap-3">
              {fotos.map((foto, index) => (
                <SortableFotoItem
                  key={foto.id}
                  foto={foto}
                  index={index}
                  disabled={disabled}
                  onRemove={handleRemove}
                  onLegendaChange={handleLegendaChange}
                />
              ))}
            </ul>
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {activeFoto ? (
              <FotoOverlayItem foto={activeFoto} index={activeIndex} />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : null}
    </div>
  );
}
