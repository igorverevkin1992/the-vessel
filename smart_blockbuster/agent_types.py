"""
Система типов и состояний для цепочки ИИ-агентов «Умного блокбастера».

Адаптировано из mediawar.core v3.3:
- Последовательная цепочка агентов (Chain of Agents)
- Машина состояний с поддержкой пошагового и автоматического режимов
- Типизированные входы/выходы каждого агента
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from .models import (
    AVScript,
    ContentType,
    EvidenceLoop,
    Hook,
    HookArchetype,
    ScriptBlock,
    SerratedPhase,
)


# ---------------------------------------------------------------------------
# Типы агентов (аналог AgentType из mediawar.core)
# ---------------------------------------------------------------------------

class AgentType(Enum):
    """
    5 агентов последовательной цепочки «Умного блокбастера».

    Адаптация mediawar.core:
      Scout  → Скаут (поиск тем)
      Radar  → Радар (вирусные углы)
      Analyst → Аналитик (факт-чекинг + визуальные якоря)
      Architect → Архитектор (структура + хук)
      Writer → Сценарист (полный A/V сценарий)
    """
    SCOUT = "scout"
    RADAR = "radar"
    ANALYST = "analyst"
    ARCHITECT = "architect"
    WRITER = "writer"
    COMPLETED = "completed"


class StepStatus(Enum):
    """Статус пошагового режима."""
    IDLE = "idle"
    WAITING_FOR_APPROVAL = "waiting"
    PROCESSING = "processing"


# ---------------------------------------------------------------------------
# Выходные структуры агентов
# ---------------------------------------------------------------------------

@dataclass
class TopicSuggestion:
    """Выход агента Scout — предложение темы (аналог mediawar TopicSuggestion)."""
    title: str
    hook_idea: str                   # Идея хука для этой темы
    content_type: ContentType        # Тип контента (расследование, эксплейнер, ...)
    archetype: HookArchetype         # Рекомендуемый архетип хука
    viral_factor: str                # Вирусный триггер (Страх, Справедливость, Деньги)


@dataclass
class RadarOutput:
    """Выход агента Radar — вирусные углы и гипотезы."""
    topic: str
    viral_angles: list[str]          # 3 вирусных угла
    dopamine_hooks: list[str]        # Идеи для дофаминовых крючков
    target_emotion: str              # Целевая эмоция
    contrarian_take: str             # Контрарный отскок (Contrarian Snapback)


@dataclass
class ResearchDossier:
    """
    Выход агента Analyst — исследовательское досье.

    Адаптация mediawar ResearchDossier + методология Харриса.
    """
    topic: str
    claims: list[str]                # Утверждения из основных источников
    counter_claims: list[str]        # Контр-утверждения / альтернативный взгляд
    visual_anchors: list[str]        # 7+ визуальных якорей (документы, карты, данные)
    data_points: list[dict[str, str]]  # Ключевые цифры {"label": ..., "value": ...}
    evidence_loops: list[EvidenceLoop]  # Готовые петли доказательств
    villain: str                     # Злодей (Система)
    victim: str                      # Жертва (Зритель)
    shocking_artifact: str           # Шокирующий артефакт для хука


@dataclass
class StructureBlueprint:
    """Выход агента Architect — структурный план видео."""
    title: str                       # Заголовок (< 60 символов)
    promise: str                     # Главное обещание (The Promise)
    hook: Hook                       # Спроектированный хук (3 шага)
    blocks: list[ScriptBlock]        # Блоки Зубчатой дуги
    thumbnail_concept: str           # Концепция превью
    duration_min: int                # Целевая длительность (мин)
    but_therefore_chain: str         # Цепочка But/Therefore


@dataclass
class WriterOutput:
    """Выход агента Writer — финальный A/V сценарий."""
    script: AVScript                 # Полный двухколоночный сценарий
    word_count: int                  # Количество слов
    block_count: int                 # Количество блоков


# ---------------------------------------------------------------------------
# Состояние системы (аналог SystemState из mediawar.core)
# ---------------------------------------------------------------------------

@dataclass
class PipelineState:
    """
    Полное состояние конвейера агентов.

    Аналог SystemState из mediawar.core, адаптированный под Python CLI.
    """
    # Управление
    current_agent: str = "idle"        # AgentType.value или "idle"
    is_processing: bool = False
    is_steppable: bool = False         # Пошаговый режим (ручное одобрение)
    step_status: str = StepStatus.IDLE.value
    logs: list[str] = field(default_factory=list)

    # Входные данные
    topic: str = ""
    content_type: Optional[str] = None

    # Выходы агентов (заполняются по мере выполнения)
    scout_suggestions: list[TopicSuggestion] = field(default_factory=list)
    radar_output: Optional[RadarOutput] = None
    research_dossier: Optional[ResearchDossier] = None
    structure_blueprint: Optional[StructureBlueprint] = None
    writer_output: Optional[WriterOutput] = None

    def add_log(self, message: str) -> None:
        """Добавить запись в лог (макс. 500)."""
        self.logs.append(message)
        if len(self.logs) > 500:
            self.logs = self.logs[-500:]

    def reset(self) -> None:
        """Сброс в начальное состояние."""
        self.current_agent = "idle"
        self.is_processing = False
        self.step_status = StepStatus.IDLE.value
        self.topic = ""
        self.content_type = None
        self.scout_suggestions = []
        self.radar_output = None
        self.research_dossier = None
        self.structure_blueprint = None
        self.writer_output = None
        self.logs = []


# ---------------------------------------------------------------------------
# Конфигурация агентов
# ---------------------------------------------------------------------------

AGENT_PIPELINE_ORDER = [
    AgentType.SCOUT,
    AgentType.RADAR,
    AgentType.ANALYST,
    AgentType.ARCHITECT,
    AgentType.WRITER,
]

AGENT_DESCRIPTIONS: dict[str, dict[str, str]] = {
    AgentType.SCOUT.value: {
        "name_ru": "Скаут (Scout)",
        "role": "Разведка тем",
        "description": (
            "Сканирует информационное поле и генерирует 4 предложения тем "
            "для «Умного блокбастера» с указанием типа контента, архетипа хука "
            "и вирусного фактора."
        ),
    },
    AgentType.RADAR.value: {
        "name_ru": "Радар (Radar)",
        "role": "Вирусные углы",
        "description": (
            "Анализирует выбранную тему через призму Дофаминовой лестницы "
            "и 4 вирусных триггеров. Определяет контрарный отскок и "
            "целевую эмоцию для максимального удержания."
        ),
    },
    AgentType.ANALYST.value: {
        "name_ru": "Аналитик (Analyst)",
        "role": "Факт-чекинг и визуальные якоря",
        "description": (
            "Формирует исследовательское досье: утверждения/контр-утверждения, "
            "7+ визуальных якорей (документы, карты, данные), Петли Доказательств, "
            "определяет Злодея (Систему) и Жертву (Зрителя)."
        ),
    },
    AgentType.ARCHITECT.value: {
        "name_ru": "Архитектор (Architect)",
        "role": "Структура и хук",
        "description": (
            "Проектирует Зубчатую дугу, конструирует трёхшаговый хук по формуле "
            "синтеза, строит цепочку But/Therefore, создаёт концепцию превью."
        ),
    },
    AgentType.WRITER.value: {
        "name_ru": "Сценарист (Writer)",
        "role": "Полный A/V сценарий",
        "description": (
            "Генерирует финальный двухколоночный сценарий в стиле Стаккато "
            "с дейктическими драйверами, коннекторами Харриса, SFX и музыкальными "
            "указаниями. Минимум 60 блоков."
        ),
    },
}
