'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminTextSchema,
  adminTextsPageSchema,
  LANGUAGES,
  type CreateTextInput,
  type Language,
} from '@tecleo/shared';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { useAuthStore } from '@/auth/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { fetchApi } from '@/lib/api';

type TextType = 'quote' | 'code';
const ALL = 'all';

/** Formulario para agregar un texto de dominio público u original (spec 4). */
function NewTextForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations('admin');
  const tLanguages = useTranslations('settings.languages');
  const id = useId();
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState<Language>('es');
  const [type, setType] = useState<TextType>('quote');
  const [author, setAuthor] = useState('');
  const [source, setSource] = useState('');
  const create = useMutation({
    mutationFn: (body: CreateTextInput) =>
      fetchApi('/admin/texts', adminTextSchema, { method: 'POST', body, auth: true }),
    onSuccess: () => {
      setContent('');
      setAuthor('');
      setSource('');
      onCreated();
    },
  });

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border p-5"
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({ content, language, type, author, source });
      }}
    >
      <h2 id={`${id}-title`} className="font-heading text-lg font-semibold">
        {t('newText')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('licenseNote')}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-content`}>{t('content')}</Label>
        <textarea
          id={`${id}-content`}
          value={content}
          required
          minLength={20}
          maxLength={2_000}
          rows={5}
          onChange={(event) => {
            setContent(event.target.value);
          }}
          className="rounded-md border bg-transparent px-3 py-2 font-game text-base"
        />
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-2">
          <span id={`${id}-language`} className="text-sm font-medium">
            {t('language')}
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby={`${id}-language`}
            value={language}
            onValueChange={(value) => {
              const next = LANGUAGES.find((candidate) => candidate === value);
              if (next) setLanguage(next);
            }}
          >
            {LANGUAGES.map((value) => (
              <ToggleGroupItem key={value} value={value} className="px-3">
                {tLanguages(value)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-2">
          <span id={`${id}-type`} className="text-sm font-medium">
            {t('type')}
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby={`${id}-type`}
            value={type}
            onValueChange={(value) => {
              if (value === 'quote' || value === 'code') setType(value);
            }}
          >
            <ToggleGroupItem value="quote" className="px-3">
              {t('types.quote')}
            </ToggleGroupItem>
            <ToggleGroupItem value="code" className="px-3">
              {t('types.code')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-author`}>{t('author')}</Label>
          <Input
            id={`${id}-author`}
            value={author}
            maxLength={120}
            onChange={(event) => {
              setAuthor(event.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-source`}>{t('source')}</Label>
          <Input
            id={`${id}-source`}
            value={source}
            maxLength={200}
            onChange={(event) => {
              setSource(event.target.value);
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={create.isPending}>
          {t('add')}
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {create.isSuccess && t('added')}
          {create.isError && <span className="text-error">{t('addError')}</span>}
        </p>
      </div>
    </form>
  );
}

function TextsTable() {
  const t = useTranslations('admin');
  const tLanguages = useTranslations('settings.languages');
  const client = useQueryClient();
  const [language, setLanguage] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const [active, setActive] = useState<string>(ALL);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page) });
  if (language !== ALL) params.set('language', language);
  if (type !== ALL) params.set('type', type);
  if (active !== ALL) params.set('active', active);
  if (q.trim()) params.set('q', q.trim());

  const texts = useQuery({
    queryKey: ['admin-texts', params.toString()],
    queryFn: () => fetchApi(`/admin/texts?${params}`, adminTextsPageSchema, { auth: true }),
    placeholderData: keepPreviousData,
  });
  const toggle = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      fetchApi(`/admin/texts/${encodeURIComponent(id)}`, adminTextSchema, {
        method: 'PATCH',
        body: { active: value },
        auth: true,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-texts'] });
    },
  });
  const filter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <section aria-labelledby="admin-list" className="flex flex-col gap-4">
      <h2 id="admin-list" className="font-heading text-lg font-semibold">
        {t('list', { total: texts.data?.total ?? 0 })}
      </h2>
      <div className="flex flex-wrap gap-3">
        <Input
          type="search"
          value={q}
          placeholder={t('search')}
          aria-label={t('search')}
          className="w-56"
          onChange={(event) => {
            filter(setQ)(event.target.value);
          }}
        />
        <Select value={language} onValueChange={filter(setLanguage)}>
          <SelectTrigger className="w-40" aria-label={t('language')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allLanguages')}</SelectItem>
            {LANGUAGES.map((value) => (
              <SelectItem key={value} value={value}>
                {tLanguages(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={filter(setType)}>
          <SelectTrigger className="w-36" aria-label={t('type')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allTypes')}</SelectItem>
            <SelectItem value="quote">{t('types.quote')}</SelectItem>
            <SelectItem value="code">{t('types.code')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={active} onValueChange={filter(setActive)}>
          <SelectTrigger className="w-40" aria-label={t('state')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allStates')}</SelectItem>
            <SelectItem value="true">{t('activeOnly')}</SelectItem>
            <SelectItem value="false">{t('inactiveOnly')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {texts.isError ? (
        <p role="alert">{t('loadError')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">{t('title')}</caption>
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="py-2 font-normal">
                  {t('content')}
                </th>
                <th scope="col" className="py-2 font-normal">
                  {t('language')}
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  {t('ratings')}
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  {t('active')}
                </th>
              </tr>
            </thead>
            <tbody>
              {texts.data?.items.map((text) => (
                <tr key={text.id} className="border-b align-top">
                  <td className="max-w-md py-2 pr-4">
                    <p className="line-clamp-2">{text.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {text.id}
                      {text.author && ` · ${text.author}`}
                    </p>
                  </td>
                  <td className="py-2">
                    {text.type === 'code' ? t('types.code') : tLanguages(text.language)}
                  </td>
                  <td className="tabular py-2 text-right">
                    {t('ratingValue', { likes: text.likes, dislikes: text.dislikes })}
                  </td>
                  <td className="py-2 text-right">
                    <Switch
                      checked={text.active}
                      aria-label={t('toggle', { id: text.id })}
                      disabled={toggle.isPending}
                      onCheckedChange={(value) => {
                        toggle.mutate({ id: text.id, value });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {texts.data && texts.data.pages > 1 && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              setPage(page - 1);
            }}
          >
            {t('previous')}
          </Button>
          <span className="tabular text-sm text-muted-foreground">
            {t('page', { page, pages: texts.data.pages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= texts.data.pages}
            onClick={() => {
              setPage(page + 1);
            }}
          >
            {t('next')}
          </Button>
        </div>
      )}
    </section>
  );
}

/** Panel de textos: solo administradores (el servidor lo exige; aquí solo se explica). */
export function AdminTextsScreen() {
  const t = useTranslations('admin');
  const { status, user } = useAuthStore();
  const client = useQueryClient();
  if (status === 'unknown')
    return (
      <p aria-busy="true" className="text-muted-foreground">
        {t('loading')}
      </p>
    );
  if (!user?.isAdmin) return <p role="alert">{t('forbidden')}</p>;
  return (
    <div className="flex flex-col gap-10">
      <NewTextForm
        onCreated={() => {
          void client.invalidateQueries({ queryKey: ['admin-texts'] });
        }}
      />
      <TextsTable />
    </div>
  );
}
