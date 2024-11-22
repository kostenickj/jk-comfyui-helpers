// src_web/common/modelInfoDialog.ts
import { $el, ComfyDialog } from "../../../../scripts/ui.js";
import { api } from "../../../../scripts/api.js";
import { addStylesheet } from "./utils.js";
addStylesheet(import.meta.url);
var MetadataDialog = class extends ComfyDialog {
  constructor() {
    super();
    this.element.classList.add("jk-nodes-model-metadata");
  }
  show(metadata) {
    super.show(
      $el(
        "div",
        Object.keys(metadata).map(
          (k) => $el("div", [
            $el("label", { textContent: k }),
            $el("span", { textContent: typeof metadata[k] === "object" ? JSON.stringify(metadata[k]) : metadata[k] })
          ])
        )
      )
    );
  }
};
var ModelInfoDialog = class _ModelInfoDialog extends ComfyDialog {
  constructor(name, node) {
    super();
    this.name = typeof name === "string" ? name : name.lora_name;
    this.node = node;
    this.element.classList.add("jk-nodes-model-info");
  }
  get customNotes() {
    return this.metadata["jk-nodes.notes"];
  }
  set customNotes(v) {
    this.metadata["jk-nodes.notes"] = v;
  }
  get hash() {
    return this.metadata["jk-nodes.sha256"];
  }
  async show(type, value) {
    this.type = type;
    const val = type === "loras" ? value.lora_name : value;
    this.lora_pref = type === "loras" ? value : void 0;
    const req2 = api.fetchApi("/jk-nodes/metadata/" + encodeURIComponent(`${type}/${val}`));
    this.info = $el("div", { style: { flex: "auto" } });
    this.img = $el("img", { style: { display: "none" } });
    this.imgWrapper = $el("div.jk-nodes-preview", [this.img]);
    this.main = $el("main", { style: { display: "flex" } }, [this.info, this.imgWrapper]);
    this.content = $el("div.jk-nodes-model-content", [$el("h2", { textContent: this.name }), this.main]);
    const loading = $el("div", { textContent: "\u2139\uFE0F Loading...", parent: this.content });
    super.show(this.content);
    this.metadata = await (await req2).json();
    this.viewMetadata.style.cursor = this.viewMetadata.style.opacity = "";
    this.viewMetadata.removeAttribute("disabled");
    loading.remove();
    this.addInfo();
  }
  createButtons() {
    const btns = super.createButtons();
    this.viewMetadata = $el("button", {
      type: "button",
      textContent: "View raw metadata",
      disabled: "disabled",
      style: {
        opacity: 0.5,
        cursor: "not-allowed"
      },
      onclick: (e) => {
        if (this.metadata) {
          new MetadataDialog().show(this.metadata);
        }
      }
    });
    btns.unshift(this.viewMetadata);
    return btns;
  }
  getNoteInfo() {
    function parseNote() {
      if (!this.customNotes) return [];
      let notes = [];
      const r = new RegExp("(\\bhttps?:\\/\\/[^\\s]+)", "g");
      let end = 0;
      let m;
      do {
        m = r.exec(this.customNotes);
        let pos;
        let fin = 0;
        if (m) {
          pos = m.index;
          fin = m.index + m[0].length;
        } else {
          pos = this.customNotes.length;
        }
        let pre = this.customNotes.substring(end, pos);
        if (pre) {
          pre = pre.replaceAll("\n", "<br>");
          notes.push(
            $el("span", {
              innerHTML: pre
            })
          );
        }
        if (m) {
          notes.push(
            $el("a", {
              href: m[0],
              textContent: m[0],
              target: "_blank"
            })
          );
        }
        end = fin;
      } while (m);
      return notes;
    }
    let textarea;
    let notesContainer;
    const editText = "\u270F\uFE0F Edit";
    const edit = $el("a", {
      textContent: editText,
      href: "#",
      style: {
        float: "right",
        color: "greenyellow",
        textDecoration: "none"
      },
      onclick: async (e) => {
        e.preventDefault();
        if (textarea) {
          this.customNotes = textarea.value;
          const resp = await api.fetchApi("/jk-nodes/metadata/notes/" + encodeURIComponent(`${this.type}/${this.name}`), {
            method: "POST",
            body: this.customNotes
          });
          if (resp.status !== 200) {
            console.error(resp);
            alert(`Error saving notes (${req.status}) ${req.statusText}`);
            return;
          }
          e.target.textContent = editText;
          textarea.remove();
          textarea = null;
          notesContainer.replaceChildren(...parseNote.call(this));
          this.node?.["jk-nodes.updateExamples"]?.();
        } else {
          e.target.textContent = "\u{1F4BE} Save";
          textarea = $el("textarea", {
            style: {
              width: "100%",
              minWidth: "200px",
              minHeight: "50px"
            },
            textContent: this.customNotes
          });
          e.target.after(textarea);
          notesContainer.replaceChildren();
          textarea.style.height = Math.min(textarea.scrollHeight, 300) + "px";
        }
      }
    });
    notesContainer = $el("div.jk-nodes-model-notes", parseNote.call(this));
    return $el(
      "div",
      {
        style: { display: "contents" }
      },
      [edit, notesContainer]
    );
  }
  addInfo() {
    const usageHint = this.metadata["modelspec.usage_hint"];
    if (usageHint) {
      this.addInfoEntry("Usage Hint", usageHint);
    }
    this.addInfoEntry("Notes", this.getNoteInfo());
  }
  addInfoEntry(name, value) {
    return $el(
      "p",
      {
        parent: this.info
      },
      [
        typeof name === "string" ? $el("label", { textContent: name + ": " }) : name,
        typeof value === "string" ? $el("span", { textContent: value }) : value
      ]
    );
  }
  async getCivitaiDetails() {
    const req2 = await fetch("https://civitai.com/api/v1/model-versions/by-hash/" + this.hash);
    if (req2.status === 200) {
      return await req2.json();
    } else if (req2.status === 404) {
      throw new Error("Model not found");
    } else {
      throw new Error(`Error loading info (${req2.status}) ${req2.statusText}`);
    }
  }
  addCivitaiInfo() {
    const promise = this.getCivitaiDetails();
    const content = $el("span", { textContent: "\u2139\uFE0F Loading..." });
    this.addInfoEntry(
      $el("label", [
        $el("img", {
          style: {
            width: "18px",
            position: "relative",
            top: "3px",
            margin: "0 5px 0 0"
          },
          src: "https://civitai.com/favicon.ico"
        }),
        $el("span", { textContent: "Civitai: " })
      ]),
      content
    );
    return promise.then((info) => {
      content.replaceChildren(
        $el("a", {
          href: "https://civitai.com/models/" + info.modelId,
          textContent: "View " + info.model.name,
          target: "_blank"
        })
      );
      const allPreviews = info.images?.filter((i) => i.type === "image");
      const previews = allPreviews?.filter((i) => i.nsfwLevel <= _ModelInfoDialog.nsfwLevel);
      if (previews?.length) {
        let previewIndex = 0;
        let preview;
        const updatePreview = () => {
          preview = previews[previewIndex];
          this.img.src = preview.url;
        };
        updatePreview();
        this.img.style.display = "";
        this.img.title = `${previews.length} previews.`;
        if (allPreviews.length !== previews.length) {
          this.img.title += ` ${allPreviews.length - previews.length} images hidden due to NSFW level.`;
        }
        this.imgSave = $el("button", {
          textContent: "Use as preview",
          parent: this.imgWrapper,
          onclick: async () => {
            const blob = await (await fetch(this.img.src)).blob();
            const name = "temp_preview." + new URL(this.img.src).pathname.split(".")[1];
            const body = new FormData();
            body.append("image", new File([blob], name));
            body.append("overwrite", "true");
            body.append("type", "temp");
            const resp = await api.fetchApi("/upload/image", {
              method: "POST",
              body
            });
            if (resp.status !== 200) {
              console.error(resp);
              alert(`Error saving preview (${req.status}) ${req.statusText}`);
              return;
            }
            await api.fetchApi("/jk-nodes/save/" + encodeURIComponent(`${this.type}/${this.name}`), {
              method: "POST",
              body: JSON.stringify({
                filename: name,
                type: "temp"
              }),
              headers: {
                "content-type": "application/json"
              }
            });
            app.refreshComboInNodes();
          }
        });
        $el("button", {
          textContent: "Show metadata",
          parent: this.imgWrapper,
          onclick: async () => {
            if (preview.meta && Object.keys(preview.meta).length) {
              new MetadataDialog().show(preview.meta);
            } else {
              alert("No image metadata found");
            }
          }
        });
        const addNavButton = (icon, direction) => {
          $el("button.jk-nodes-preview-nav", {
            textContent: icon,
            parent: this.imgWrapper,
            onclick: async () => {
              previewIndex += direction;
              if (previewIndex < 0) {
                previewIndex = previews.length - 1;
              } else if (previewIndex >= previews.length) {
                previewIndex = 0;
              }
              updatePreview();
            }
          });
        };
        if (previews.length > 1) {
          addNavButton("\u2039", -1);
          addNavButton("\u203A", 1);
        }
      } else if (info.images?.length) {
        $el("span", { style: { opacity: 0.6 }, textContent: "\u26A0\uFE0F All images hidden due to NSFW level setting.", parent: this.imgWrapper });
      }
      return info;
    }).catch((err) => {
      content.textContent = "\u26A0\uFE0F " + err.message;
    });
  }
};
export {
  ModelInfoDialog
};
