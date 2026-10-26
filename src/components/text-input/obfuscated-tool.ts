const OBFUSCATED_TAG = "SPAN";
const OBFUSCATED_CLASS = "mcg-obfuscated";
const OBFUSCATED_DATA_KEY = "mcgObfuscated";

export default class ObfuscatedTool {
  private api: any;
  private onChange?: () => void;
  private button: HTMLButtonElement | null = null;
  private iconClasses: { base: string; active: string };

  constructor({ api, config }: { api: any; config?: { onChange?: () => void } }) {
    this.api = api;
    this.onChange = config?.onChange;
    this.iconClasses = {
      base: this.api.styles.inlineToolButton,
      active: this.api.styles.inlineToolButtonActive,
    };
  }

  static get isInline() {
    return true;
  }

  static get shortcut() {
    return "CMD+K";
  }

  static get title() {
    return "Obfuscated";
  }

  static get sanitize() {
    return {
      span: {
        class: OBFUSCATED_CLASS,
        "data-mcg-obfuscated": "true",
      },
    };
  }

  render() {
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.classList.add(this.iconClasses.base, "ce-inline-tool--obfuscated");
    this.button.innerHTML = this.icon;
    return this.button;
  }

  surround(range: Range | null) {
    if (!range || range.collapsed) return;

    const selectedTag = this.findObfuscatedParent();

    if (selectedTag) {
      this.unwrapInsideTag(selectedTag, range);
    } else if (this.rangeHasObfuscated(range)) {
      this.unwrapFragmentRange(range);
    } else {
      this.wrapRange(range);
    }

    this.notifyChange();
  }

  checkState() {
    const isActive = Boolean(this.findObfuscatedParent());
    this.button?.classList.toggle(this.iconClasses.active, isActive);
    return isActive;
  }

  private get icon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 8h10M7 12h10M7 16h10"></path>
        <path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M9 7l6 10M15 7L9 17"></path>
      </svg>
    `;
  }

  private findObfuscatedParent(): HTMLElement | null {
    const selection = window.getSelection();
    let node = selection?.anchorNode ?? null;
    let obfuscatedParent: HTMLElement | null = null;

    if (node?.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }

    while (node instanceof HTMLElement) {
      if (node.tagName === OBFUSCATED_TAG && this.isObfuscatedElement(node)) {
        obfuscatedParent = node;
      }
      node = node.parentElement;
    }

    return obfuscatedParent;
  }

  private wrapRange(range: Range) {
    const obfuscatedAncestors = this.getObfuscatedAncestors(range);
    const fragment = range.extractContents();
    this.unwrapObfuscatedElements(fragment);
    this.removeEmptyObfuscatedAncestors(obfuscatedAncestors);

    const wrapper = this.createWrapper();
    wrapper.append(fragment);
    range.insertNode(wrapper);
    this.api.selection.expandToTag(wrapper);
  }

  private rangeHasObfuscated(range: Range) {
    const selectedContent = range.cloneContents();
    return Boolean(selectedContent.querySelector?.(`.${OBFUSCATED_CLASS}, [data-mcg-obfuscated="true"]`));
  }

  private unwrapFragmentRange(range: Range) {
    const selection = window.getSelection();
    const isBackward = this.isBackwardSelection(selection, range);
    const obfuscatedAncestors = this.getObfuscatedAncestors(range);
    const fragment = range.extractContents();
    this.unwrapObfuscatedElements(fragment);
    this.removeEmptyObfuscatedAncestors(obfuscatedAncestors);

    const selectedNodes = Array.from(fragment.childNodes);
    range.insertNode(fragment);
    this.restoreSelectionAround(selectedNodes, isBackward);
  }

  private unwrapInsideTag(wrapper: HTMLElement, range: Range) {
    const parent = wrapper.parentNode;
    if (!parent) return;

    const originalRange = range.cloneRange();
    const startsInside = this.isWithin(wrapper, range.startContainer);
    const endsInside = this.isWithin(wrapper, range.endContainer);
    const selection = window.getSelection();
    const isBackward = this.isBackwardSelection(selection, range);

    const wrapperRange = document.createRange();
    wrapperRange.selectNodeContents(wrapper);

    const selectedRange = range.cloneRange();
    if (!this.isWithin(wrapper, selectedRange.startContainer)) {
      selectedRange.setStart(wrapperRange.startContainer, wrapperRange.startOffset);
    }
    if (!this.isWithin(wrapper, selectedRange.endContainer)) {
      selectedRange.setEnd(wrapperRange.endContainer, wrapperRange.endOffset);
    }
    if (selectedRange.collapsed) return;

    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(wrapper);
    beforeRange.setEnd(selectedRange.startContainer, selectedRange.startOffset);

    const afterRange = document.createRange();
    afterRange.selectNodeContents(wrapper);
    afterRange.setStart(selectedRange.endContainer, selectedRange.endOffset);

    const before = beforeRange.cloneContents();
    const selected = selectedRange.cloneContents();
    const after = afterRange.cloneContents();
    this.unwrapObfuscatedElements(selected);
    this.removeEmptyObfuscatedElements(before);
    this.removeEmptyObfuscatedElements(after);

    const beforeWrapper = this.createWrapper();
    beforeWrapper.append(before);

    const afterWrapper = this.createWrapper();
    afterWrapper.append(after);

    if (beforeWrapper.hasChildNodes()) {
      parent.insertBefore(beforeWrapper, wrapper);
    }
    const selectedNodes = Array.from(selected.childNodes);
    parent.insertBefore(selected, wrapper);
    if (afterWrapper.hasChildNodes()) {
      parent.insertBefore(afterWrapper, wrapper);
    }
    parent.removeChild(wrapper);
    this.restoreUnwrappedSelection(originalRange, selectedNodes, startsInside, endsInside, isBackward);
  }

  private isWithin(element: HTMLElement, node: Node) {
    return node === element || element.contains(node);
  }

  private getObfuscatedAncestors(range: Range) {
    const ancestors = new Set<HTMLElement>();
    [range.startContainer, range.endContainer].forEach((boundary) => {
      let node: Node | null = boundary.nodeType === Node.TEXT_NODE ? boundary.parentNode : boundary;
      while (node instanceof HTMLElement) {
        if (node.tagName === OBFUSCATED_TAG && this.isObfuscatedElement(node)) {
          ancestors.add(node);
        }
        node = node.parentElement;
      }
    });
    return Array.from(ancestors);
  }

  private removeEmptyObfuscatedAncestors(ancestors: HTMLElement[]) {
    ancestors.forEach((element) => {
      if (!element.hasChildNodes()) {
        element.remove();
      }
    });
  }

  private removeEmptyObfuscatedElements(root: Node | null) {
    if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;

    const selector = `.${OBFUSCATED_CLASS}, [data-mcg-obfuscated="true"]`;
    const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
    if (root instanceof HTMLElement && root.matches(selector)) {
      elements.unshift(root);
    }

    elements.reverse().forEach((element) => {
      if (!element.hasChildNodes()) {
        element.remove();
      }
    });
  }

  private restoreSelectionAround(nodes: Node[], isBackward = false) {
    if (nodes.length === 0) return;

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.setStartBefore(nodes[0]);
    range.setEndAfter(nodes[nodes.length - 1]);
    selection.removeAllRanges();
    this.applySelection(selection, range, isBackward);
  }

  private restoreUnwrappedSelection(
    originalRange: Range,
    selectedNodes: Node[],
    startsInside: boolean,
    endsInside: boolean,
    isBackward: boolean,
  ) {
    if (selectedNodes.length === 0) return;

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    if (startsInside) {
      range.setStartBefore(selectedNodes[0]);
    } else {
      range.setStart(originalRange.startContainer, originalRange.startOffset);
    }
    if (endsInside) {
      range.setEndAfter(selectedNodes[selectedNodes.length - 1]);
    } else {
      range.setEnd(originalRange.endContainer, originalRange.endOffset);
    }

    selection.removeAllRanges();
    this.applySelection(selection, range, isBackward);
  }

  private isBackwardSelection(selection: Selection | null, range: Range) {
    return Boolean(
      selection?.anchorNode === range.endContainer &&
      selection.anchorOffset === range.endOffset &&
      (selection.anchorNode !== range.startContainer || selection.anchorOffset !== range.startOffset),
    );
  }

  private applySelection(selection: Selection, range: Range, isBackward: boolean) {
    if (isBackward && selection.setBaseAndExtent) {
      selection.setBaseAndExtent(range.endContainer, range.endOffset, range.startContainer, range.startOffset);
    } else {
      selection.addRange(range);
    }
  }

  private unwrapObfuscatedElements(root: ParentNode) {
    root.querySelectorAll<HTMLElement>(`.${OBFUSCATED_CLASS}, [data-mcg-obfuscated="true"]`).forEach((element) => {
      const parent = element.parentNode;
      if (!parent) return;

      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
    });

    if (root instanceof HTMLElement && this.isObfuscatedElement(root)) {
      root.classList.remove(OBFUSCATED_CLASS);
      root.removeAttribute("data-mcg-obfuscated");
    }
  }

  private isObfuscatedElement(element: HTMLElement) {
    return element.classList.contains(OBFUSCATED_CLASS) || element.dataset[OBFUSCATED_DATA_KEY] === "true";
  }

  private createWrapper() {
    const wrapper = document.createElement("span");
    wrapper.classList.add(OBFUSCATED_CLASS);
    wrapper.dataset[OBFUSCATED_DATA_KEY] = "true";
    return wrapper;
  }

  private notifyChange() {
    this.onChange?.();
  }
}
